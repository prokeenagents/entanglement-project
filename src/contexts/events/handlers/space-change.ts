import type { EventHandler } from './types';

/** What the user is told, per resource. */
const MESSAGE: Record<App.Events.SpaceChangeEvent['resource'], string> = {
    space: 'Space changed',
    agent: 'Agent changed'
};

/**
 * `space-change` — a space, or one of its agents, was mutated org-side.
 *
 * Two things happen, in this order:
 *
 * 1. Tell the user. `alert()` is deliberate and deliberately crude — it is the
 *    proof the whole org→site channel is live (ms-space webhook → receiver →
 *    bus broadcast → this browser's parked poll). Swap it for a toast once the
 *    boilerplate grows one; the handler is the only place that changes.
 * 2. `router.refresh()` — the server re-runs the layout, `getConsumerData()`
 *    reads the connector's space cache (which the receiver refreshed BEFORE
 *    publishing), and the new spaces + agents flow down as props. No client
 *    fetch, no local cache to invalidate.
 *
 * NOT terminal: unlike `logout` this doesn't `stop()` the poll loop and doesn't
 * navigate. A user mid-conversation stays exactly where they are; only the data
 * behind the page is re-read. If the change removed the agent they're talking
 * to, the relay is the authority on that and answers the next send with E3101 —
 * this handler deliberately doesn't try to predict it.
 */
export const spaceChange: EventHandler<App.Events.SpaceChangeEvent> = (event, { router }) => {
    // Guard rather than assume: this runs in the browser, but the handler index is
    // imported by a module that Next also evaluates on the server.
    if (typeof window !== 'undefined') {
        window.alert(MESSAGE[event.resource]);
    }

    router.refresh();
};
