import type { EventHandler } from './types';

/**
 * `space-change` — a space, or one of its agents, was mutated org-side.
 *
 * `router.refresh()` is the whole reaction, and it is enough: the server re-runs the
 * layout, `getConsumerData()` reads the connector's space cache — which the webhook
 * receiver already refreshed before publishing this — and the new spaces + agents
 * flow down as props. No client fetch, no local cache to invalidate.
 *
 * NOT terminal: unlike `logout` this doesn't `stop()` the poll loop, and it doesn't
 * navigate. A user mid-conversation stays exactly where they are; only the data
 * behind the page is re-read. If the change removed the agent they're talking to,
 * the relay is the authority on that and answers the next send with E3101 — this
 * handler deliberately doesn't try to predict it.
 */
export const spaceChange: EventHandler<App.Events.SpaceChangeEvent> = (_event, { router }) => {
    router.refresh();
};
