'use client';

import { Badge, Box, HStack, Stack, Text } from '@chakra-ui/react';

/**
 * Agent output is a plain token stream — the orchestrator LLM writes its tool
 * directives INTO its own text as a `<SYSTEM CALL>…</SYSTEM CALL>` fence, which
 * the flow engine parses to route to the tool flow. The relay forwards those
 * tokens verbatim, so without this the fence shows up as raw markup in the
 * bubble. This module turns each fence into a labelled chip and leaves the prose
 * around it untouched.
 *
 * The fence body carries `!*`-prefixed fields:
 *   <SYSTEM CALL>
 *   !*action
 *   use tool flow
 *   !*tool
 *   Offer Tool
 *   !*context
 *   { "check": 10 }
 *   </SYSTEM CALL>
 */
const OPEN = '<SYSTEM CALL>';
const CLOSE = '</SYSTEM CALL>';

type Segment =
    | { kind: 'text'; text: string }
    | { kind: 'tool'; action: string; tool: string; context: string; streaming: boolean };

/**
 * Read one `!*<name>` field out of a fence body: everything from the marker up
 * to the next `!*` marker (or the end). Missing field → '' so a half-formed call
 * mid-stream still renders whatever has arrived.
 */
const readField = (body: string, name: string): string => {
    const marker = `!*${name}`;
    const start = body.indexOf(marker);

    if (start === -1) {
        return '';
    }

    const from = start + marker.length;
    const next = body.indexOf('!*', from);

    return body.slice(from, next === -1 ? body.length : next).trim();
};

const parseCall = (body: string, streaming: boolean): Segment => ({
    kind: 'tool',
    action: readField(body, 'action'),
    tool: readField(body, 'tool'),
    context: readField(body, 'context'),
    streaming
});

/**
 * Split agent text into ordered prose + tool-call segments.
 *
 * Streaming-aware: a `<SYSTEM CALL>` whose closing tag hasn't arrived yet is
 * emitted as a `streaming: true` tool segment, so the raw `!*action…` markup
 * never flashes on screen while the agent is still typing the directive. Plain
 * text with no fence returns a single text segment — identical to the old
 * behaviour, so ordinary answers are unaffected.
 */
export const parseAgentSegments = (text: string): Segment[] => {
    const segments: Segment[] = [];
    let cursor = 0;

    while (cursor < text.length) {
        const open = text.indexOf(OPEN, cursor);

        if (open === -1) {
            segments.push({ kind: 'text', text: text.slice(cursor) });
            break;
        }

        if (open > cursor) {
            segments.push({ kind: 'text', text: text.slice(cursor, open) });
        }

        const bodyStart = open + OPEN.length;
        const close = text.indexOf(CLOSE, bodyStart);

        if (close === -1) {
            // Opening fence seen, closing tag not streamed yet — an in-flight call.
            segments.push(parseCall(text.slice(bodyStart), true));
            break;
        }

        segments.push(parseCall(text.slice(bodyStart, close), false));
        cursor = close + CLOSE.length;
    }

    return segments;
};

/** One tool-call directive, rendered as a chip instead of raw markup. */
const ToolCallChip: React.FC<{ call: Extract<Segment, { kind: 'tool' }> }> = ({ call }) => (
    <Box colorPalette="purple" borderWidth="1px" borderColor="border.emphasized" bg="bg.muted" borderRadius="md" px={3} py={2} w="full">
        <HStack gap={2}>
            <Badge colorPalette="purple" size="sm">
                {call.streaming ? 'Tool call · running…' : 'Tool call'}
            </Badge>
            {call.tool && (
                <Text fontSize="sm" fontWeight="semibold">
                    {call.tool}
                </Text>
            )}
            {call.action && (
                <Text fontSize="xs" color="fg.muted">
                    {call.action}
                </Text>
            )}
        </HStack>

        {call.context && (
            <Text as="pre" mt={1} fontSize="xs" fontFamily="mono" color="fg.muted" whiteSpace="pre-wrap" wordBreak="break-word">
                {call.context}
            </Text>
        )}
    </Box>
);

/**
 * The body of an `agent` bubble: prose rendered as text, `<SYSTEM CALL>` fences
 * rendered as chips. Not memoized — MessageRow's memo already gates this on the
 * message reference, so only the row whose text is actually growing re-parses.
 * Positional index is the correct key: segments only append/grow as tokens
 * stream in, so a given position keeps its identity across renders.
 */
export const AgentBody: React.FC<{ text: string }> = ({ text }) => {
    const segments = parseAgentSegments(text);

    return (
        <Stack gap={2} w="full">
            {segments.map((segment, index) =>
                segment.kind === 'tool' ? (
                    <ToolCallChip key={index} call={segment} />
                ) : (
                    segment.text.trim() && (
                        <Text key={index} whiteSpace="pre-wrap" wordBreak="break-word">
                            {segment.text}
                        </Text>
                    )
                )
            )}
        </Stack>
    );
};
