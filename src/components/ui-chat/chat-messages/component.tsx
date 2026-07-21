'use client';

import { memo, useEffect, useRef, useState } from 'react';
import { Badge, Box, Card, HStack, Separator, Spinner, Stack, Text } from '@chakra-ui/react';

import { useConsumer } from '@/contexts/consumer';
import { useChat } from '../chat-shell';
import { AgentBody } from './system-call';

const HISTORY_LIMIT = 50;

const ROLE_STYLE: Record<App.ChatUI.MessageRole, { align: 'flex-start' | 'flex-end'; palette: string; label: string }> = {
    user: { align: 'flex-end', palette: 'blue', label: 'You' },
    agent: { align: 'flex-start', palette: 'green', label: 'Agent' },
    event: { align: 'flex-start', palette: 'gray', label: 'Engine' },
    error: { align: 'flex-start', palette: 'red', label: 'Error' }
};

/**
 * One bubble, memoized on its `message`.
 *
 * This is the whole performance story of a streaming chat. Every `token` event
 * replaces ONLY the streaming message's object (the shell's `map` returns the
 * same reference for every other row), so React.memo's shallow compare skips
 * every unchanged row and re-renders just the one that's growing. Without it, a
 * 300-token answer re-reconciles the entire transcript 300 times. Rendered inline
 * in the parent map instead, memo can't help — the elements are rebuilt each pass.
 */
const MessageRow = memo(function MessageRow({ message }: { message: App.ChatUI.Message }) {
    const style = ROLE_STYLE[message.role];

    const variant = message.role === 'user' ? 'elevated' : '';

    return (
        <HStack w="full" justify={style.align}>
            <Card.Root maxW="100%" variant={variant as 'elevated'}>
                <Card.Body py={2} px={3}>
                    <HStack gap={2} mb={1}>
                        <Badge colorPalette={style.palette} size="sm">
                            {style.label}
                        </Badge>
                        <Separator w="full" />
                    </HStack>
                    {message.role === 'agent' ? (
                        <AgentBody text={message.text} />
                    ) : (
                        <Text whiteSpace="pre-wrap" wordBreak="break-word">
                            {message.text}
                        </Text>
                    )}
                </Card.Body>
            </Card.Root>
        </HStack>
    );
});

/**
 * Flatten persisted history into chat bubbles.
 *
 * Two shape details drive this:
 *  - The rows come back NEWEST-FIRST, so they're reversed to read chronologically.
 *  - Each row is a WHOLE EXCHANGE — the history surface returns only `initial=true`
 *    rows (sub-agent / tool calls are excluded), so one row carries BOTH the user's
 *    prompt AND the final answer. One row therefore becomes TWO bubbles, not one.
 */
/**
 * A cancelled turn is persisted by the engine as
 * `"<partial-or-placeholder> :: Canceled ::"` — the display row's text with a
 * marker appended. `PENDING_PLACEHOLDER` is the text a freshly-created row holds
 * before any answer streams in, so a run cancelled before the agent said
 * anything reads as "Pending... :: Canceled ::".
 */
const CANCELED_MARKER = ':: Canceled ::';
const PENDING_PLACEHOLDER = 'Pending...';

const historyToMessages = (items: Keen.ChatHistoryItem[]): App.ChatUI.Message[] =>
    [...items].reverse().flatMap(item => {
        const rows: App.ChatUI.Message[] = [{ id: `${item.id}-prompt`, role: 'user', text: item.prompt }];

        if (!item.response) {
            return rows;
        }

        // Split a cancelled row back into the shape a LIVE cancel produces: any real
        // partial answer as an agent bubble, then a quiet 'Canceled.' row. The
        // no-partial case (just the placeholder) collapses to "Canceled." alone —
        // never the raw "Pending... :: Canceled ::".
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
        rows.push({
            id: `${item.id}-response`,
            role: item.responseType === 'error' ? 'error' : 'agent',
            text: item.response
        });

        return rows;
    });

/**
 * The conversation: persisted history (last 50 turns, fetched once on mount) then
 * this session's live turns from the shell.
 *
 * History is HTTP (a two-token call through /api/chat/history) while the live
 * turns arrive over the WS — two different transports, one list. They can't
 * duplicate within a mount: a turn sent now is only in `messages`, and it only
 * becomes history on the next mount.
 *
 * `event` rows are deliberately visible rather than hidden: an agent run is slow
 * and multi-step, so without them a long turn looks like a hung page.
 */
export const Component: React.FC = () => {
    const { messages, running, status, chatID } = useChat();
    const consumer = useConsumer();

    const [history, setHistory] = useState<App.ChatUI.Message[]>([]);
    const [loading, setLoading] = useState(true);
    const bottom = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let cancelled = false;

        const load = async () => {
            const reply = await consumer.chat.history(chatID, { limit: HISTORY_LIMIT });

            // The component may have unmounted (or the thread changed) mid-flight —
            // don't write into a dead render.
            if (cancelled) {
                return;
            }

            // Narrowing on `success` is what makes `data` present + typed; a failed
            // reply carries no data. A brand-new chat legitimately has no history,
            // so a failure here is not worth shouting about — the live turns still work.
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

    // Follow the tail as tokens stream in (and once history lands).
    useEffect(() => {
        bottom.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, history]);

    if (loading) {
        return (
            <Box py={10} textAlign="center">
                <Spinner size="sm" />
            </Box>
        );
    }

    const all = [...history, ...messages];

    if (all.length === 0) {
        return (
            <Box py={10} textAlign="center">
                <Text color="fg.muted">{status === 'connected' ? 'Say something to the agent.' : 'Connecting…'}</Text>
            </Box>
        );
    }

    return (
        <Stack gap={3} w="full" my={3}>
            {all.map(message => (
                <MessageRow key={message.id} message={message} />
            ))}

            {running && (
                <Text fontSize="sm" color="fg.muted">
                    Agent is working…
                </Text>
            )}

            <div ref={bottom} />
        </Stack>
    );
};

Component.displayName = 'ChatMessages';
