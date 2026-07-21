/**
 * The contract for a global event handler — one per event type, registered in the
 * handler index (./index.ts).
 *
 * To add a reaction: extend `App.Events.Event` with the new `type`, drop a file in
 * this folder that exports an `EventHandler`, and register it in the index. The
 * events context looks the arriving event's `type` up in the index and runs the
 * match, handing it this context.
 */
export interface EventHandlerContext {
    /** The app router — navigate / refresh from a handler. */
    router: ReturnType<typeof import('next/navigation').useRouter>;
    /** Stop the long-poll loop — for terminal reactions like logout. */
    stop: () => void;
    /**
     * The signed-in user's id (token `sub`), or undefined before it's known — a
     * handler compares the event's target `consumerId` to this so it only ever acts
     * for the current user.
     */
    userId: string | undefined;
}

export type EventHandler = (event: App.Events.Event, context: EventHandlerContext) => void | Promise<void>;
