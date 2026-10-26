'use client';

import { useState } from 'react';
import { Badge, Box, Collapsible, HStack, Spinner, Stack, Text } from '@chakra-ui/react';
import { LuActivity, LuBrain, LuChevronDown, LuCircleDot, LuCog, LuMessageCircle, LuSparkles, LuWrench } from 'react-icons/lu';

import { formatDuration } from '@/utils/time';

/**
 * The agent's work for one turn, as a timeline: engine events (thinking /
 * processing / progress), tool calls with their input, and interim narration.
 *
 * Open while the turn runs (so a long run reads as progress, not a frozen
 * screen), then settles to the reader's preference — collapsed by default, so
 * people can read just the answer and expand the steps when they care. The chat
 * header's "Steps" toggle sets that preference for every turn.
 */

const EVENT_META: Record<string, { label: string; icon: React.ReactNode }> = {
    thinking: { label: 'Thinking', icon: <LuBrain size={14} /> },
    processing: { label: 'Processing', icon: <LuCog size={14} /> },
    progress: { label: 'Progress', icon: <LuActivity size={14} /> }
};

const eventMeta = (event: string) => EVENT_META[event] ?? { label: event.charAt(0).toUpperCase() + event.slice(1), icon: <LuCircleDot size={14} /> };

/** Pretty-print a JSON tool input when it parses; leave anything else as-is. */
const prettyContext = (context: string) => {
    try {
        return JSON.stringify(JSON.parse(context), null, 2);
    } catch {
        return context;
    }
};

const offset = (at: number | undefined, startedAt: number | undefined) => (at && startedAt ? `+${((at - startedAt) / 1000).toFixed(1)}s` : null);

const StepDot = ({ children, tone = 'muted', live }: { children: React.ReactNode; tone?: 'muted' | 'brand'; live?: boolean }) => (
    <Box
        position="relative"
        zIndex="1"
        flexShrink={0}
        w="26px"
        h="26px"
        display="grid"
        placeItems="center"
        borderRadius="full"
        borderWidth="1px"
        borderColor={tone === 'brand' ? 'brand.border' : 'border.emphasized'}
        bg={tone === 'brand' ? 'brand.subtle' : 'bg.panel'}
        color={tone === 'brand' ? 'brand.fg' : 'fg.muted'}
        className={live ? 'kn-pulse' : undefined}
    >
        {children}
    </Box>
);

const ToolStep = ({ step, startedAt }: { step: Extract<App.ChatUI.TraceStep, { kind: 'tool' }>; startedAt?: number }) => {
    const [open, setOpen] = useState(false);
    const context = step.context ? prettyContext(step.context) : '';

    return (
        <HStack align="flex-start" gap="3">
            <StepDot tone="brand" live={step.streaming}>
                {step.streaming ? <Spinner size="xs" /> : <LuWrench size={13} />}
            </StepDot>
            <Box flex="1" minW="0" pt="0.5">
                <HStack gap="2" wrap="wrap">
                    <Text fontSize="sm" fontWeight="600">
                        {step.streaming ? 'Calling' : 'Called'} {step.tool || 'a tool'}
                    </Text>
                    {step.action && (
                        <Badge size="sm" variant="subtle" colorPalette="brand">
                            {step.action}
                        </Badge>
                    )}
                    {offset(step.at, startedAt) && (
                        <Text fontSize="xs" color="fg.subtle" fontFamily="mono">
                            {offset(step.at, startedAt)}
                        </Text>
                    )}
                </HStack>
                {context && (
                    <Box mt="1.5">
                        <Text
                            as="button"
                            fontSize="xs"
                            color="fg.muted"
                            cursor="pointer"
                            display="inline-flex"
                            alignItems="center"
                            gap="1"
                            _hover={{ color: 'fg' }}
                            onClick={() => setOpen(!open)}
                            aria-expanded={open}
                        >
                            <Box as="span" transform={open ? 'rotate(0deg)' : 'rotate(-90deg)'} transition="transform 0.15s ease" display="inline-flex">
                                <LuChevronDown size={12} />
                            </Box>
                            {open ? 'Hide input' : 'Show input'}
                        </Text>
                        {open && (
                            <Box
                                as="pre"
                                mt="1.5"
                                p="3"
                                fontSize="12px"
                                lineHeight="1.55"
                                fontFamily="mono"
                                bg="bg.code"
                                borderWidth="1px"
                                borderColor="border"
                                borderRadius="control"
                                overflowX="auto"
                                whiteSpace="pre-wrap"
                                wordBreak="break-word"
                                color="fg.muted"
                            >
                                {context}
                            </Box>
                        )}
                    </Box>
                )}
            </Box>
        </HStack>
    );
};

const Step = ({ step, startedAt, live }: { step: App.ChatUI.TraceStep; startedAt?: number; live: boolean }) => {
    if (step.kind === 'tool') {
        return <ToolStep step={step} startedAt={startedAt} />;
    }

    const isNote = step.kind === 'note';
    const meta = isNote ? { label: 'Note', icon: <LuMessageCircle size={13} /> } : eventMeta(step.event);

    return (
        <HStack align="flex-start" gap="3">
            <StepDot live={live}>{meta.icon}</StepDot>
            <Box flex="1" minW="0" pt="0.5">
                <HStack gap="2">
                    <Text fontSize="sm" fontWeight="600" color={isNote ? 'fg.muted' : 'fg'}>
                        {meta.label}
                    </Text>
                    {offset(step.at, startedAt) && (
                        <Text fontSize="xs" color="fg.subtle" fontFamily="mono">
                            {offset(step.at, startedAt)}
                        </Text>
                    )}
                </HStack>
                <Text fontSize="sm" color="fg.muted" lineHeight="1.6" whiteSpace="pre-wrap" fontStyle={isNote ? 'italic' : 'normal'}>
                    {step.text}
                </Text>
            </Box>
        </HStack>
    );
};

type RunTraceProps = {
    turn: App.ChatUI.Turn;
    /** This turn is the one currently running. */
    live: boolean;
    /** The reader's "show steps" preference. */
    defaultOpen: boolean;
};

export const RunTrace = ({ turn, live, defaultOpen }: RunTraceProps) => {
    const [override, setOverride] = useState<boolean | null>(null);
    const open = override ?? (live || defaultOpen);

    const tools = turn.steps.filter(step => step.kind === 'tool').length;
    const current = turn.steps[turn.steps.length - 1];
    const duration = turn.startedAt && turn.endedAt && turn.endedAt > turn.startedAt ? formatDuration(turn.endedAt - turn.startedAt) : null;

    const summary = [duration && `Worked for ${duration}`, `${turn.steps.length} ${turn.steps.length === 1 ? 'step' : 'steps'}`, tools > 0 && `${tools} ${tools === 1 ? 'tool call' : 'tool calls'}`]
        .filter(Boolean)
        .join(' · ');

    const liveLabel = current ? (current.kind === 'tool' ? `Calling ${current.tool || 'a tool'}` : current.kind === 'event' ? eventMeta(current.event).label : 'Working') : 'Thinking';

    return (
        <Collapsible.Root open={open} onOpenChange={details => setOverride(details.open)}>
            <Box borderWidth="1px" borderColor={live ? 'brand.border' : 'border'} borderRadius="card" bg="bg.subtle" overflow="hidden" transition="border-color 0.2s ease">
                <Collapsible.Trigger asChild>
                    <HStack as="button" w="full" gap="2.5" px="3.5" py="2.5" cursor="pointer" textAlign="left" _hover={{ bg: 'bg.muted' }} transition="background 0.15s ease">
                        <Box color="brand.fg" display="inline-flex">
                            {live ? <Spinner size="xs" /> : <LuSparkles size={15} />}
                        </Box>
                        {live ? (
                            <HStack gap="2" flex="1" minW="0">
                                <Text fontSize="sm" fontWeight="600" className="kn-shimmer" truncate>
                                    {liveLabel}
                                </Text>
                                <span className="kn-dots" aria-hidden="true">
                                    <i />
                                    <i />
                                    <i />
                                </span>
                            </HStack>
                        ) : (
                            <Text fontSize="sm" fontWeight="500" color="fg.muted" flex="1" truncate>
                                {summary}
                            </Text>
                        )}
                        <Text fontSize="xs" color="fg.subtle" display={{ base: 'none', sm: 'block' }}>
                            {open ? 'Hide steps' : 'Show steps'}
                        </Text>
                        <Box color="fg.subtle" transform={open ? 'rotate(180deg)' : 'none'} transition="transform 0.2s ease" display="inline-flex">
                            <LuChevronDown size={16} />
                        </Box>
                    </HStack>
                </Collapsible.Trigger>
                <Collapsible.Content>
                    <Box px="3.5" pt="1" pb="3.5" position="relative">
                        {/* the timeline spine */}
                        <Box position="absolute" left="26.5px" top="3" bottom="6" w="1px" bg="border.emphasized" aria-hidden="true" />
                        <Stack gap="3.5">
                            {turn.steps.length === 0 && live && <Step step={{ kind: 'event', id: 'pending', event: 'thinking', text: 'Starting the run…' }} live />}
                            {turn.steps.map((step, index) => (
                                <Step key={step.id} step={step} startedAt={turn.startedAt} live={live && index === turn.steps.length - 1} />
                            ))}
                        </Stack>
                    </Box>
                </Collapsible.Content>
            </Box>
        </Collapsible.Root>
    );
};
