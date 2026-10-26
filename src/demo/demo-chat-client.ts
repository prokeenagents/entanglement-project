'use client';

import { recordDemoTurn } from './demo-store';

/**
 * Demo mode's fake agent (utils/demo.ts). Implements App.ChatUI.Client — the same
 * surface ChatShell drives on the real ChatAPI — and replays the wire shape the
 * relay produces: `thinking` / `processing` / `progress` stream events, `token`
 * events that carry the answer (including a `<SYSTEM CALL>` tool fence), and the
 * "TaskQueue cancelled" rejection on cancel.
 *
 * Type a prompt containing "fail" or "error" to see the error path; anything that
 * mentions an order, a return, or a lookup runs a tool call; the rest is a plain
 * streamed answer.
 */

const CANCELLED_MESSAGE = 'TaskQueue cancelled';

type Step = { type: 'event'; event: string; text: string; delay: number } | { type: 'tokens'; text: string; perToken: number } | { type: 'fail'; message: string; delay: number };

const toolScript = (prompt: string): Step[] => [
    { type: 'event', event: 'thinking', text: 'Reading the request and deciding which tool can answer it.', delay: 450 },
    { type: 'tokens', text: 'Let me look that up for you. ', perToken: 28 },
    {
        type: 'tokens',
        text: `<SYSTEM CALL>\n!*action\nuse tool flow\n!*tool\nOrder Lookup\n!*context\n{ "query": ${JSON.stringify(prompt.slice(0, 60))}, "fields": ["status", "carrier", "eta"] }\n</SYSTEM CALL>`,
        perToken: 14
    },
    { type: 'event', event: 'processing', text: 'Order Lookup returned 3 fields in 412 ms.', delay: 1100 },
    { type: 'event', event: 'progress', text: 'Composing the answer.', delay: 350 },
    {
        type: 'tokens',
        text: 'Here is what I found:\n\n- **Status:** out for delivery\n- **Carrier:** DHL Express, last scan 07:48\n- **ETA:** today between 16:00 and 18:00\n\nWould you like me to send the live tracking link by SMS?',
        perToken: 26
    }
];

const plainScript = (): Step[] => [
    { type: 'event', event: 'thinking', text: 'Understanding the question.', delay: 500 },
    {
        type: 'tokens',
        text: "Happy to help. Here's a quick overview of what I can do:\n\n1. **Answer questions** about orders, accounts and policies.\n2. **Look things up** in connected systems using my tools.\n3. **Take actions** such as starting a return or updating details, and I always confirm first.\n\nWhat would you like to start with?",
        perToken: 24
    }
];

const failScript = (): Step[] => [
    { type: 'event', event: 'thinking', text: 'Planning the steps for this request.', delay: 500 },
    { type: 'fail', message: 'The agent run failed: upstream service timed out (E5004). The team has been notified.', delay: 1300 }
];

const pickScript = (prompt: string): Step[] => {
    if (/fail|error|broken/i.test(prompt)) {
        return failScript();
    }

    if (/order|track|return|look ?up|check|where|status|invoice/i.test(prompt)) {
        return toolScript(prompt);
    }

    return plainScript();
};

/** Split into word-ish tokens that keep their whitespace, like an LLM stream. */
const tokenize = (text: string) => text.match(/\s*\S+\s*/g) ?? [text];

export class DemoChatClient implements App.ChatUI.Client {
    private statusHandlers = new Set<App.Chat.StatusHandler>();
    private runningHandlers = new Set<App.Chat.RunningHandler>();
    private streamHandlers = new Set<App.Chat.StreamEventHandler>();
    private cancelled = false;
    private running = false;
    private timer: ReturnType<typeof setTimeout> | null = null;
    private pendingReject: ((err: Error) => void) | null = null;

    constructor(private readonly agentSlug: string) {}

    onStatus(handler: App.Chat.StatusHandler) {
        this.statusHandlers.add(handler);
        return () => void this.statusHandlers.delete(handler);
    }

    onRunning(handler: App.Chat.RunningHandler) {
        this.runningHandlers.add(handler);
        return () => void this.runningHandlers.delete(handler);
    }

    onStream(handler: App.Chat.StreamEventHandler) {
        this.streamHandlers.add(handler);
        return () => void this.streamHandlers.delete(handler);
    }

    connect() {
        this.emitStatus('connecting');
        this.timer = setTimeout(() => this.emitStatus('connected'), 350);
    }

    disconnect() {
        // Same unwind as cancel() so an in-flight runFlow settles instead of dangling.
        this.cancel();
        this.emitStatus('disconnected');
    }

    setAccessToken() {
        // Nothing to rotate — the fake never talks to the relay.
    }

    cancel() {
        this.cancelled = true;

        // Unwind the in-flight wait immediately, like the SDK's drain loop does.
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.pendingReject?.(new Error(CANCELLED_MESSAGE));
        this.pendingReject = null;
    }

    async runFlow(input: App.Chat.RunFlowInput): Promise<unknown> {
        if (this.running) {
            throw new Error('TaskQueue already running');
        }

        this.cancelled = false;
        this.setRunning(true);

        let answer = '';

        try {
            for (const step of pickScript(input.prompt)) {
                if (step.type === 'event') {
                    await this.wait(step.delay);
                    this.emit(step.event, step.text);
                    continue;
                }

                if (step.type === 'fail') {
                    await this.wait(step.delay);
                    recordDemoTurn(input.chatId, this.agentSlug, input.prompt, step.message, 'error');
                    throw new Error(step.message);
                }

                for (const token of tokenize(step.text)) {
                    await this.wait(step.perToken);
                    answer += token;
                    this.emit('token', token);
                }
            }

            recordDemoTurn(input.chatId, this.agentSlug, input.prompt, answer, 'text');

            return new Map();
        } catch (err) {
            if ((err as Error).message === CANCELLED_MESSAGE) {
                recordDemoTurn(input.chatId, this.agentSlug, input.prompt, `${answer || 'Pending...'} :: Canceled ::`, 'text');
            }

            throw err;
        } finally {
            this.setRunning(false);
        }
    }

    private wait(ms: number) {
        return new Promise<void>((resolve, reject) => {
            if (this.cancelled) {
                reject(new Error(CANCELLED_MESSAGE));
                return;
            }

            this.pendingReject = reject;
            this.timer = setTimeout(() => {
                this.pendingReject = null;
                resolve();
            }, ms);
        });
    }

    private emit(event: string, text: string) {
        for (const handler of this.streamHandlers) {
            handler(event, { text });
        }
    }

    private emitStatus(status: App.Chat.ConnectStatus) {
        for (const handler of this.statusHandlers) {
            handler(status);
        }
    }

    private setRunning(next: boolean) {
        this.running = next;
        for (const handler of this.runningHandlers) {
            handler(next);
        }
    }
}
