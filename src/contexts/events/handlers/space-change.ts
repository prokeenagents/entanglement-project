import type { EventHandler } from './types';

/** What the user is told, per resource. */
const NOTICE: Record<App.Events.SpaceChangeEvent['resource'], App.Notice.Notice> = {
    space: {
        title: 'Space changed',
        message: 'A space was updated in your organization.'
    },
    agent: {
        title: 'Agent changed',
        message: 'An agent in your organization was updated.'
    }
};

/**
 * `space-change` — a space, or one of its agents, was mutated org-side.
 *
 * Raises the blocking notice dialog: it can only be dismissed with the X or OK, so
 * the change is acknowledged rather than swiped away. That also makes it the proof
 * the whole org→site channel is live (ms-space webhook → receiver → bus broadcast →
 * this browser's parked poll).
 *
 * NOT terminal: unlike `logout` this doesn't `stop()` the poll loop and doesn't
 * navigate. A user mid-conversation stays exactly where they are. If the change
 * removed the agent they're talking to, the relay is the authority on that and
 * answers the next send with E3101 — this handler doesn't try to predict it.
 */
export const spaceChange: EventHandler<App.Events.SpaceChangeEvent> = (event, { notice }) => {
    notice.show(NOTICE[event.resource]);
};
