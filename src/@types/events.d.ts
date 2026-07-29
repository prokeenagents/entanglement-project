export {};

declare global {
    namespace App {
        namespace Events {
            /** Fields every server→client event carries. */
            interface BaseEvent {
                /** Optional human-readable reason (e.g. 'account removed', 'spaces updated'). */
                reason?: string;
                /** When the event was published (epoch ms). */
                at: number;
            }

            /**
             * `logout` — force the browser to sign out (account removed, contract
             * changed, or spaces changed — all re-auth via a fresh login).
             *
             * TARGETED: published on the consumer's own bus key.
             */
            interface LogoutEvent extends BaseEvent {
                type: 'logout';
                /**
                 * The consumer this event targets. The bus already routes it to that
                 * consumer's browser, but the handler ALSO checks this equals the current
                 * user before acting — so a stray/broadcast event can never sign out the
                 * wrong person.
                 */
                consumerId: string;
            }

            /**
             * `space-change` — a space, or one of the agents attached to it, was
             * mutated org-side (the `r_space` / `r_agent` webhooks).
             *
             * GLOBAL: published on the broadcast key, so EVERY signed-in browser gets
             * it. Spaces and agents are org-wide configuration, not per-consumer
             * state — the change is the same for everyone, and which of it a given
             * consumer may actually see is decided by their token's `space` claim on
             * the next render. Hence no `consumerId`: there is nobody to target.
             */
            interface SpaceChangeEvent extends BaseEvent {
                type: 'space-change';
                /**
                 * WHICH of the two mutated — `r_space` or `r_agent`. A discrete field
                 * rather than something parsed back out of `reason`, so a handler can
                 * branch on it without depending on human-readable wording.
                 */
                resource: 'space' | 'agent';
            }

            /**
             * `agent-front-settings-change` — an agent's partner-facing Front
             * Settings were saved org-side (the `r_agent_front_settings` webhook).
             * The receiver has ALREADY re-fetched the fresh values into the
             * connector cache before publishing, so a handler (or a page reading
             * /api/agent-front-settings) sees the new state immediately.
             *
             * GLOBAL: front settings are org-wide partner configuration — the same
             * for every signed-in browser, nobody to target.
             */
            interface AgentFrontSettingsChangeEvent extends BaseEvent {
                type: 'agent-front-settings-change';
            }

            /**
             * A server→client event delivered down the long-poll channel
             * (GET /api/events). Extend the union as more push events are needed —
             * each `type` gets its own handler file under contexts/events/handlers.
             */
            type Event = LogoutEvent | SpaceChangeEvent | AgentFrontSettingsChangeEvent;
        }
    }
}
