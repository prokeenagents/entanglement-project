import { logout } from './logout';
import { spaceChange } from './space-change';
import type { EventHandler, EventHandlerContext, EventHandlerMap } from './types';

/**
 * The handler INDEX — one entry per event type, each backed by its own file.
 *
 * To add a reaction: extend `App.Events.Event` with the new type, add a handler file
 * in this folder, and register it here. `Partial` because not every event type needs
 * a global handler — some may be handled only by component subscriptions (useEvents).
 */
const handlers: EventHandlerMap = {
    logout,
    'space-change': spaceChange
};

/**
 * Dispatch one event to its registered handler. Called by the events context for
 * every incoming event; a type with no handler is a no-op. Awaits the handler so a
 * terminal one (logout) finishes — clears the session + redirects — before the loop
 * checks `stop`.
 */
export async function busHandler(event: App.Events.Event, context: EventHandlerContext): Promise<void> {
    // The map is keyed BY the event's own `type`, so the entry always matches this
    // event's member of the union — but TS can't correlate the two through an index
    // lookup, hence the cast. EventHandlerMap is what actually enforces the pairing,
    // at registration time above.
    const handler = handlers[event.type] as EventHandler | undefined;

    if (handler) {
        await handler(event, context);
    }
}
