export {};

declare global {
    namespace App {
        namespace ChatUI {
            /**
             * `user`  — what the consumer typed.
             * `agent` — the model's answer, accumulated from `token` stream events.
             * `event` — engine progress (thinking / processing / progress); shown so
             *           the run is legible rather than a frozen screen.
             * `error` — a failed run, or an `error` stream event.
             */
            type MessageRole = 'user' | 'agent' | 'event' | 'error';

            interface Message {
                id: string;
                role: MessageRole;
                /** The stream event name — only set on `event` / `error` rows. */
                event?: string;
                text: string;
                /** Epoch ms when the row was created — drives step timing in the run trace. */
                at?: number;
            }

            /**
             * The slice of the chat SDK the UI drives. The real ChatAPI satisfies it
             * structurally; demo mode swaps in an in-memory fake (src/demo).
             */
            interface Client {
                onStatus: (handler: App.Chat.StatusHandler) => App.Chat.Unsubscribe;
                onRunning: (handler: App.Chat.RunningHandler) => App.Chat.Unsubscribe;
                onStream: (handler: App.Chat.StreamEventHandler) => App.Chat.Unsubscribe;
                connect: () => void;
                disconnect: () => void;
                setAccessToken: (accessToken: string) => void;
                runFlow: (input: App.Chat.RunFlowInput) => Promise<unknown>;
                cancel: () => void;
            }

            /** One entry in a turn's run trace, in the order it happened. */
            type TraceStep =
                | { kind: 'event'; id: string; event: string; text: string; at?: number }
                | { kind: 'tool'; id: string; action: string; tool: string; context: string; streaming: boolean; at?: number }
                | { kind: 'note'; id: string; text: string; at?: number };

            /**
             * A user prompt and everything the agent did about it: the steps it took
             * (engine events, tool calls, interim narration) and its final answer.
             */
            interface Turn {
                id: string;
                prompt: Message | null;
                steps: TraceStep[];
                /** The final answer — the prose after the last tool call. */
                answer: string;
                errors: Message[];
                canceled: boolean;
                /** Epoch ms of the first / last row — the "worked for" duration. */
                startedAt?: number;
                endedAt?: number;
            }
        }
    }
}
