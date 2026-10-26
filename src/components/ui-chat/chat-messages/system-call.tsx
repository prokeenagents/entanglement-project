/**
 * Agent output is a plain token stream — the orchestrator LLM writes its tool
 * directives INTO its own text as a `<SYSTEM CALL>…</SYSTEM CALL>` fence, which
 * the flow engine parses to route to the tool flow. The relay forwards those
 * tokens verbatim, so without this the fence shows up as raw markup in the
 * bubble. This module splits each fence out as a structured tool call (rendered
 * as a step in the run trace — see turns.ts / run-trace.tsx) and leaves the prose
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

type Segment = { kind: 'text'; text: string } | { kind: 'tool'; action: string; tool: string; context: string; streaming: boolean };

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
