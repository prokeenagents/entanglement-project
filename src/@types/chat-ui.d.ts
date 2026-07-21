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
            }
        }
    }
}
