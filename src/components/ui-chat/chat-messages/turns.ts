import { parseAgentSegments } from './system-call';

/**
 * Fold the flat message stream into TURNS — one user prompt plus everything the
 * agent did about it — so the UI can show the work (a collapsible run trace) apart
 * from the result (the final answer).
 *
 * The stream is ordered (ChatShell opens a new agent row after every engine
 * event), and each agent row's text may embed `<SYSTEM CALL>` tool fences. Per
 * turn, every piece lands in order, then:
 *
 *   - engine events (thinking / processing / progress) and tool calls → steps
 *   - prose BEFORE the last tool call ("let me check that…")        → note steps
 *   - prose AFTER the last tool call                                → the answer
 *
 * With no tool call at all, every word of prose is the answer. Pure + cheap: it
 * re-runs on every streamed token, over at most MAX_MESSAGES rows.
 */

type Piece =
    | { kind: 'text'; id: string; text: string; at?: number }
    | { kind: 'event'; id: string; event: string; text: string; at?: number }
    | { kind: 'tool'; id: string; action: string; tool: string; context: string; streaming: boolean; at?: number };

type Draft = {
    id: string;
    prompt: App.ChatUI.Message | null;
    pieces: Piece[];
    errors: App.ChatUI.Message[];
    canceled: boolean;
    startedAt?: number;
    endedAt?: number;
};

const newDraft = (id: string, prompt: App.ChatUI.Message | null): Draft => ({
    id,
    prompt,
    pieces: [],
    errors: [],
    canceled: false,
    startedAt: prompt?.at,
    endedAt: prompt?.at
});

const finish = (draft: Draft): App.ChatUI.Turn => {
    const lastTool = draft.pieces.reduce((found, piece, index) => (piece.kind === 'tool' ? index : found), -1);

    const steps: App.ChatUI.TraceStep[] = [];
    let answer = '';

    draft.pieces.forEach((piece, index) => {
        if (piece.kind === 'text') {
            if (index > lastTool) {
                answer += piece.text;
            } else if (piece.text.trim()) {
                steps.push({ kind: 'note', id: piece.id, text: piece.text.trim(), at: piece.at });
            }

            return;
        }

        steps.push(piece);
    });

    return {
        id: draft.id,
        prompt: draft.prompt,
        steps,
        answer: answer.trim(),
        errors: draft.errors,
        canceled: draft.canceled,
        startedAt: draft.startedAt,
        endedAt: draft.endedAt
    };
};

export function buildTurns(messages: App.ChatUI.Message[]): App.ChatUI.Turn[] {
    const drafts: Draft[] = [];
    let current: Draft | null = null;

    for (const message of messages) {
        if (message.role === 'user') {
            current = newDraft(message.id, message);
            drafts.push(current);
            continue;
        }

        // Rows before any prompt (e.g. history that starts mid-thread) get a turn of their own.
        if (!current) {
            current = newDraft(message.id, null);
            drafts.push(current);
        }

        if (message.at) {
            current.startedAt = current.startedAt ?? message.at;
            current.endedAt = message.at;
        }

        if (message.role === 'error') {
            current.errors.push(message);
            continue;
        }

        if (message.role === 'event') {
            if (message.event === 'canceled') {
                current.canceled = true;
            } else {
                current.pieces.push({ kind: 'event', id: message.id, event: message.event ?? 'event', text: message.text, at: message.at });
            }

            continue;
        }

        parseAgentSegments(message.text).forEach((segment, index) => {
            const id = `${message.id}-${index}`;

            current!.pieces.push(segment.kind === 'text' ? { kind: 'text', id, text: segment.text, at: message.at } : { ...segment, id, at: message.at });
        });
    }

    return drafts.map(finish);
}
