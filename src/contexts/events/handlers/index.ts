import { logout } from './logout';
import type { EventHandler, EventHandlerContext } from './types';

/**
 * The handler INDEX — one entry per event type, each backed by its own file.
 *
 * To add a reaction: extend `App.Events.Event` with the new type, add a handler file
 * in this folder, and register it here. `Partial` because not every event type needs
 * a global handler — some may be handled only by component subscriptions (useEvents).
 */
const handlers: Partial<Record<App.Events.Event['type'], EventHandler>> = {
    logout
};

/**
 * Dispatch one event to its registered handler. Called by the events context for
 * every incoming event; a type with no handler is a no-op. Awaits the handler so a
 * terminal one (logout) finishes — clears the session + redirects — before the loop
 * checks `stop`.
 */
export async function busHandler(event: App.Events.Event, context: EventHandlerContext): Promise<void> {
    const handler = handlers[event.type];

    if (handler) {
        await handler(event, context);
    }
}
