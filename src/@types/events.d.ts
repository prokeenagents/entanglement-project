export {};

declare global {
    namespace App {
        namespace Events {
            /**
             * A server→client event delivered down the long-poll channel
             * (GET /api/events). Routed to a single consumer server-side.
             */
            interface Event {
                /**
                 * `logout` — force the browser to sign out (account removed, contract
                 * changed, or spaces changed — all re-auth via a fresh login). Extend the
                 * union as more push events are needed.
                 */
                type: 'logout';
                /**
                 * The consumer this event targets. The bus already routes it to that
                 * consumer's browser, but the handler ALSO checks this equals the current
                 * user before acting — so a stray/broadcast event can never sign out the
                 * wrong person.
                 */
                consumerId: string;
                /** Optional human-readable reason (e.g. 'account removed', 'spaces updated'). */
                reason?: string;
                /** When the event was published (epoch ms). */
                at: number;
            }
        }
    }
}
