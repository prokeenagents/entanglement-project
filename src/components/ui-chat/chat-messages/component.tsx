'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { Box, Button, Center, chakra, Container, HStack, IconButton, SimpleGrid, Skeleton, Stack, Text } from '@chakra-ui/react';
import { LuArrowDown, LuCheck, LuCircleStop, LuCopy, LuRotateCcw, LuTriangleAlert } from 'react-icons/lu';

import { AgentAvatar } from '@/components/ui/agent-avatar';
import { Tooltip } from '@/components/ui/tooltip';
import { useConsumer } from '@/contexts/consumer';
import { BRAND } from '@/theme/brand.config';
import { useChat } from '../chat-shell';
import { Markdown } from './markdown';
import { RunTrace } from './run-trace';
import { buildTurns } from './turns';

const HISTORY_LIMIT = 50;

/** How close to the bottom (px) still counts as "following" the stream. */
const STICKY_THRESHOLD = 120;

/**
 * A cancelled turn is persisted by the engine as
 * `"<partial-or-placeholder> :: Canceled ::"` — the display row's text with a
 * marker appended. `PENDING_PLACEHOLDER` is the text a freshly-created row holds
 * before any answer streams in, so a run cancelled before the agent said
 * anything reads as "Pending... :: Canceled ::".
 */
const CANCELED_MARKER = ':: Canceled ::';
const PENDING_PLACEHOLDER = 'Pending...';

/**
 * Flatten persisted history into message rows.
 *
 *  - The rows come back NEWEST-FIRST, so they're reversed to read chronologically.
 *  - Each row is a WHOLE EXCHANGE — the history surface returns only `initial=true`
 *    rows (sub-agent / tool calls are excluded), so one row carries BOTH the user's
 *    prompt AND the final answer. One row therefore becomes TWO messages.
 */
const historyToMessages = (items: Keen.ChatHistoryItem[]): App.ChatUI.Message[] =>
    [...items].reverse().flatMap(item => {
        const rows: App.ChatUI.Message[] = [{ id: `${item.id}-prompt`, role: 'user', text: item.prompt }];

        if (!item.response) {
            return rows;
        }

        // Split a cancelled row back into the shape a LIVE cancel produces: any real
        // partial answer, then a quiet 'Canceled.' row. The no-partial case (just the
        // placeholder) collapses to "Canceled." alone — never the raw marker.
        const cancelAt = item.response.indexOf(CANCELED_MARKER);

        if (cancelAt !== -1) {
            const partial = item.response.slice(0, cancelAt).trim();

            if (partial && partial !== PENDING_PLACEHOLDER) {
                rows.push({ id: `${item.id}-response`, role: 'agent', text: partial });
            }

            rows.push({ id: `${item.id}-canceled`, role: 'event', event: 'canceled', text: 'Canceled.' });

            return rows;
        }

        // A turn that failed is stored with responseType 'error'; everything else is
        // the agent's answer.
        rows.push({ id: `${item.id}-response`, role: item.responseType === 'error' ? 'error' : 'agent', text: item.response });

        return rows;
    });

/* ---------------------------------------------------------------------------- */

const UserBubble = ({ text }: { text: string }) => (
    <HStack justify="flex-end" w="full">
        <Box
            maxW={{ base: '88%', md: '75%' }}
            px="4"
            py="3"
            bg="brand.solid"
            color="brand.contrast"
            borderRadius="bubble"
            borderBottomRightRadius="calc(var(--chakra-radii-bubble) * 0.3)"
            boxShadow="composer"
            fontSize="15px"
            lineHeight="1.6"
            fontWeight="500"
            whiteSpace="pre-wrap"
            wordBreak="break-word"
        >
            {text}
        </Box>
    </HStack>
);

const CopyButton = ({ text }: { text: string }) => {
    const [copied, setCopied] = useState(false);

    return (
        <Tooltip content={copied ? 'Copied' : 'Copy answer'}>
            <IconButton
                aria-label="Copy answer"
                size="xs"
                variant="ghost"
                color="fg.subtle"
                onClick={() =>
                    void navigator.clipboard?.writeText(text).then(() => {
                        setCopied(true);
                        setTimeout(() => setCopied(false), 1500);
                    })
                }
            >
                {copied ? <LuCheck /> : <LuCopy />}
            </IconButton>
        </Tooltip>
    );
};

/** Cheap content fingerprint of a step — only the LAST step of a turn can still be growing. */
const stepSignature = (step: App.ChatUI.TraceStep | undefined) => {
    if (!step) {
        return '';
    }

    return step.kind === 'tool' ? `${step.id}:${step.streaming}:${step.tool}:${step.context.length}` : `${step.id}:${step.text.length}`;
};

type TurnViewProps = {
    turn: App.ChatUI.Turn;
    agentName: string;
    live: boolean;
    showSteps: boolean;
    onRetry: (prompt: string) => void;
    canRetry: boolean;
};

/**
 * One exchange. buildTurns returns fresh objects on every token, so the memo
 * compares CONTENT (answer, step count, the last step's fingerprint): finished
 * turns compare equal and skip, so a long transcript doesn't re-render per token.
 */
const TurnView = memo(
    function TurnView({ turn, agentName, live, showSteps, onRetry, canRetry }: TurnViewProps) {
        const hasAgentOutput = live || turn.steps.length > 0 || turn.answer || turn.errors.length > 0 || turn.canceled;

        return (
            <Stack gap="4" className="kn-rise">
                {turn.prompt && <UserBubble text={turn.prompt.text} />}

                {hasAgentOutput && (
                    <HStack align="flex-start" gap="3" w="full">
                        <AgentAvatar name={agentName} size={30} display={{ base: 'none', sm: 'block' }} mt="0.5" />
                        <Stack gap="3" flex="1" minW="0">
                            <Text fontSize="xs" fontWeight="600" color="fg.muted" mt="1">
                                {agentName}
                            </Text>

                            {(turn.steps.length > 0 || (live && !turn.answer)) && <RunTrace key={String(showSteps)} turn={turn} live={live && !turn.answer} defaultOpen={showSteps} />}

                            {turn.answer && (
                                <Box>
                                    <Markdown text={turn.answer} />
                                    {live && <span className="kn-caret" aria-hidden="true" />}
                                </Box>
                            )}

                            {turn.errors.map(error => (
                                <HStack
                                    key={error.id}
                                    align="flex-start"
                                    gap="3"
                                    px="4"
                                    py="3"
                                    borderRadius="card"
                                    bg={{ _dark: 'rgba(239,68,68,0.06)', _light: 'rgba(254,226,226,0.6)' }}
                                    borderWidth="1px"
                                    borderColor={{ _dark: 'rgba(239,68,68,0.18)', _light: 'rgba(239,68,68,0.22)' }}
                                    role="alert"
                                >
                                    <Box color="fg.error" mt="0.5">
                                        <LuTriangleAlert size={16} />
                                    </Box>
                                    <Box flex="1" minW="0">
                                        <Text fontSize="xs" fontWeight="700" textTransform="uppercase" letterSpacing="0.08em" color="fg.error" mb="1">
                                            Something went wrong
                                        </Text>
                                        <Text fontSize="sm" color="fg" lineHeight="1.6" wordBreak="break-word">
                                            {error.text}
                                        </Text>
                                        {turn.prompt && canRetry && (
                                            <Button size="xs" variant="ghost" colorPalette="brand" mt="2" ml="-2" onClick={() => onRetry(turn.prompt!.text)}>
                                                <LuRotateCcw /> Try again
                                            </Button>
                                        )}
                                    </Box>
                                </HStack>
                            ))}

                            {turn.canceled && (
                                <HStack gap="1.5" color="fg.subtle" fontSize="xs">
                                    <LuCircleStop size={13} />
                                    <Text>Stopped</Text>
                                </HStack>
                            )}

                            {!live && turn.answer && (
                                <HStack gap="1" ml="-1.5">
                                    <CopyButton text={turn.answer} />
                                    {turn.prompt && canRetry && (
                                        <Tooltip content="Ask again">
                                            <IconButton aria-label="Ask again" size="xs" variant="ghost" color="fg.subtle" onClick={() => onRetry(turn.prompt!.text)}>
                                                <LuRotateCcw />
                                            </IconButton>
                                        </Tooltip>
                                    )}
                                </HStack>
                            )}
                        </Stack>
                    </HStack>
                )}
            </Stack>
        );
    },
    (prev, next) =>
        prev.live === next.live &&
        prev.showSteps === next.showSteps &&
        prev.canRetry === next.canRetry &&
        prev.agentName === next.agentName &&
        prev.turn.answer === next.turn.answer &&
        prev.turn.steps.length === next.turn.steps.length &&
        stepSignature(prev.turn.steps[prev.turn.steps.length - 1]) === stepSignature(next.turn.steps[next.turn.steps.length - 1]) &&
        prev.turn.errors.length === next.turn.errors.length &&
        prev.turn.canceled === next.turn.canceled &&
        prev.turn.prompt?.id === next.turn.prompt?.id
);

/* ---------------------------------------------------------------------------- */

const EmptyConversation = ({ agentName, spaceTitle, connected, onPick }: { agentName: string; spaceTitle?: string; connected: boolean; onPick: (prompt: string) => void }) => (
    <Center flex="1" py="10" px="4">
        <Stack align="center" textAlign="center" maxW="640px" w="full" gap="0" className="kn-fade">
            <Box position="relative" mb="6" filter="drop-shadow(0 0 40px var(--chakra-colors-brand-glow))">
                <AgentAvatar name={agentName} size={76} online={connected} icon />
            </Box>
            {spaceTitle && (
                <Text fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="0.14em" color="brand.fg" mb="3">
                    {spaceTitle} · {connected ? 'Live' : 'Connecting'}
                </Text>
            )}
            <Text as="h2" fontSize={{ base: '2xl', md: '3xl' }} fontWeight="700" letterSpacing="-0.025em" lineHeight="1.2" mb="3">
                Start a conversation with{' '}
                <Box as="span" bgImage="var(--chakra-gradients-brand)" bgClip="text" color="transparent">
                    {agentName}
                </Box>
            </Text>
            <Text color="fg.muted" fontSize={{ base: 'sm', md: 'md' }} lineHeight="1.6" maxW="460px">
                Ask anything. You&apos;ll see each step the agent takes, and you can expand them any time.
            </Text>
            <SimpleGrid columns={{ base: 1, sm: 2 }} gap="3" mt="8" w="full" textAlign="left">
                {BRAND.suggestedPrompts.map(item => (
                    <chakra.button
                        key={item.title}
                        type="button"
                        p="4"
                        borderRadius="card"
                        borderWidth="1px"
                        borderColor="border"
                        bg="bg.glass"
                        backdropFilter="blur(22px) saturate(155%)"
                        cursor={connected ? 'pointer' : 'not-allowed'}
                        opacity={connected ? 1 : 0.6}
                        transition="all 0.18s ease"
                        _hover={connected ? { borderColor: 'brand.border', bg: 'bg.glassHover' } : undefined}
                        _focusVisible={{ outline: '2px solid', outlineColor: 'brand.500', outlineOffset: '2px' }}
                        disabled={!connected}
                        onClick={() => onPick(item.prompt)}
                    >
                        <Text fontSize="sm" fontWeight="600" mb="1">
                            {item.title}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" lineClamp={2}>
                            {item.prompt}
                        </Text>
                    </chakra.button>
                ))}
            </SimpleGrid>
        </Stack>
    </Center>
);

const HistorySkeleton = () => (
    <Stack gap="8" py="8">
        {[0, 1].map(key => (
            <Stack key={key} gap="4">
                <HStack justify="flex-end">
                    <Skeleton h="11" w="55%" borderRadius="bubble" />
                </HStack>
                <HStack align="flex-start" gap="3">
                    <Skeleton h="30px" w="30px" borderRadius="control" />
                    <Stack flex="1" gap="2">
                        <Skeleton h="3" w="20%" />
                        <Skeleton h="4" w="90%" />
                        <Skeleton h="4" w="75%" />
                    </Stack>
                </HStack>
            </Stack>
        ))}
    </Stack>
);

type ChatMessagesProps = {
    agentName: string;
    spaceTitle?: string;
    /** The reader's "show steps" preference (chat header toggle). */
    showSteps: boolean;
};

/**
 * The conversation: persisted history (last 50 turns, fetched once on mount) then
 * this session's live turns from the shell, folded into turns (see turns.ts).
 *
 * History is HTTP (a two-token call through /api/chat/history) while the live
 * turns arrive over the WS — two different transports, one list. They can't
 * duplicate within a mount: a turn sent now is only in `messages`, and it only
 * becomes history on the next mount.
 *
 * Owns the scroll container so it can follow the stream only while the reader is
 * at the bottom — scrolling up to re-read isn't yanked back by the next token.
 */
export const Component = ({ agentName, spaceTitle, showSteps }: ChatMessagesProps) => {
    const { messages, running, status, chatID, send } = useChat();
    const consumer = useConsumer();

    const [history, setHistory] = useState<App.ChatUI.Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [following, setFollowing] = useState(true);
    const scroller = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const reply = await consumer.chat.history(chatID, { limit: HISTORY_LIMIT });

            // The component may have unmounted (or the thread changed) mid-flight —
            // don't write into a dead render.
            if (cancelled) {
                return;
            }

            // A brand-new chat legitimately has no history, so a failure here is not
            // worth shouting about — the live turns still work.
            if (reply.success) {
                setHistory(historyToMessages(reply.data.items));
            }

            setLoading(false);
        };

        void load();

        return () => {
            cancelled = true;
        };
    }, [chatID, consumer.chat]);

    const turns = useMemo(() => buildTurns([...history, ...messages]), [history, messages]);

    // Follow the tail as tokens stream in — only while the reader is at the bottom.
    useEffect(() => {
        const el = scroller.current;

        if (el && following) {
            el.scrollTo({ top: el.scrollHeight, behavior: loading ? 'auto' : 'smooth' });
        }
    }, [turns, following, loading]);

    // A new prompt always snaps back to the bottom.
    const lastPromptId = turns[turns.length - 1]?.prompt?.id;
    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setFollowing(true);
    }, [lastPromptId]);

    const onScroll = () => {
        const el = scroller.current;

        if (el) {
            setFollowing(el.scrollHeight - el.scrollTop - el.clientHeight < STICKY_THRESHOLD);
        }
    };

    const connected = status === 'connected';
    const canSend = connected && !running;
    const empty = !loading && turns.length === 0;

    return (
        <Box position="relative" flex="1" minH="0" display="flex" flexDirection="column">
            <Box ref={scroller} onScroll={onScroll} flex="1" minH="0" overflowY="auto" display="flex" flexDirection="column" aria-live="polite" aria-busy={running}>
                {empty ? (
                    <EmptyConversation agentName={agentName} spaceTitle={spaceTitle} connected={connected} onPick={prompt => void send(prompt)} />
                ) : (
                    <Container maxW="820px" px={{ base: '4', md: '6' }} py={{ base: '5', md: '8' }}>
                        {loading ? (
                            <HistorySkeleton />
                        ) : (
                            <Stack gap={{ base: '7', md: '9' }}>
                                {turns.map((turn, index) => (
                                    <TurnView
                                        key={turn.id}
                                        turn={turn}
                                        agentName={agentName}
                                        live={running && index === turns.length - 1}
                                        showSteps={showSteps}
                                        canRetry={canSend}
                                        onRetry={prompt => void send(prompt)}
                                    />
                                ))}
                            </Stack>
                        )}
                    </Container>
                )}
            </Box>

            {!following && !empty && (
                <IconButton
                    aria-label="Scroll to latest"
                    size="sm"
                    variant="outline"
                    borderRadius="full"
                    bg="bg.chrome"
                    boxShadow="pop"
                    position="absolute"
                    bottom="3"
                    left="50%"
                    transform="translateX(-50%)"
                    className="kn-rise"
                    onClick={() => setFollowing(true)}
                >
                    <LuArrowDown />
                </IconButton>
            )}
        </Box>
    );
};

Component.displayName = 'ChatMessages';
