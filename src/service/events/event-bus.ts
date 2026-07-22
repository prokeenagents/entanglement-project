/**
 * Server→client event bus that backs the long-poll channel.
 *
 * The entanglement SERVER receives org→site webhooks (e.g. Keen deleted a consumer
 * in the org), but those land on the server — not in the user's browser. This bus
 * bridges the gap: the webhook receiver PUBLISHES an event keyed by consumer id, and
 * that consumer's browser — holding an open GET /api/events — is handed the event and
 * reacts (today: signs out).
 *
 * It is a per-process, in-memory singleton (stashed on globalThis like the keen
 * connector), which is correct for a SINGLE instance. With multiple instances each
 * holds its own bus + its own held polls, so a webhook that hits instance A can't
 * wake a poll parked on instance B — for that, back this with shared pub/sub
 * (Redis/dragonfly `PUBLISH`/`SUBSCRIBE`). Fine for the self-hosted single-node
 * boilerplate.
 */
export type BusEvent = App.Events.Event;

/**
 * The BROADCAST key. Events published here are for every signed-in browser, not one
 * consumer — org-wide config changes (spaces / agents) rather than per-user pushes.
 * It is a reserved key: consumer ids are cuids, so it can never collide with one.
 * Every parked poll waits on this key IN ADDITION to its own consumer key.
 */
export const GLOBAL_EVENT_KEY = 'global_info';

type Waiter = (events: BusEvent[]) => void;

export class EventBus {
    /** Events published while no poll was parked — drained by the next poll. */
    private readonly queues = new Map<string, BusEvent[]>();
    /** Parked long-polls per key, woken by publish(). */
    private readonly waiters = new Map<string, Set<Waiter>>();

    /**
     * Deliver an event to a key — a consumer id for a targeted push, or
     * GLOBAL_EVENT_KEY for a broadcast. Wakes EVERY parked poll for that key (so all
     * their open tabs react), or queues it when none is parked.
     */
    publish(key: string, event: BusEvent): void {
        const parked = this.waiters.get(key);

        if (parked && parked.size > 0) {
            for (const waiter of [...parked]) {
                waiter([event]);
            }
            return;
        }

        const queue = this.queues.get(key) ?? [];
        queue.push(event);
        this.queues.set(key, queue);
    }

    /**
     * Park for up to `timeoutMs`, resolving with the key's events the moment one
     * arrives (or immediately if any were queued). Resolves with `[]` on timeout so
     * the client re-polls — a held request that never returns would be killed by
     * proxies anyway, so we return empty well inside those limits.
     */
    wait(key: string, timeoutMs: number): Promise<BusEvent[]> {
        return this.waitAny([key], timeoutMs);
    }

    /**
     * Park on SEVERAL keys at once — a poll waits on its own consumer key AND the
     * broadcast key — resolving on the first event from any of them.
     *
     * One waiter attached to every key, detached from ALL of them the moment it
     * settles. Racing N separate `wait()` calls instead would leave the losers parked
     * until their own timeout, so each re-poll would pile another orphan onto the
     * broadcast key for up to a full poll window.
     */
    waitAny(keys: string[], timeoutMs: number): Promise<BusEvent[]> {
        for (const key of keys) {
            const queued = this.queues.get(key);

            if (queued && queued.length > 0) {
                this.queues.delete(key);
                return Promise.resolve(queued);
            }
        }

        return new Promise<BusEvent[]>(resolve => {
            let settled = false;

            const finish = (events: BusEvent[]): void => {
                if (settled) {
                    return;
                }

                settled = true;
                clearTimeout(timer);

                for (const key of keys) {
                    this.detach(key, waiter);
                }

                resolve(events);
            };

            const waiter: Waiter = events => finish(events);
            const timer = setTimeout(() => finish([]), timeoutMs);

            for (const key of keys) {
                this.attach(key, waiter);
            }
        });
    }

    private attach(key: string, waiter: Waiter): void {
        const set = this.waiters.get(key) ?? new Set<Waiter>();

        set.add(waiter);
        this.waiters.set(key, set);
    }

    private detach(key: string, waiter: Waiter): void {
        const set = this.waiters.get(key);

        if (!set) {
            return;
        }

        set.delete(waiter);

        if (set.size === 0) {
            this.waiters.delete(key);
        }
    }
}

declare global {
    var __eventBus: EventBus | undefined;
}

/**
 * The one process-wide bus. Created on first use and kept on globalThis so it
 * survives dev HMR (a module-level `new` would give each reloaded bundle its own).
 */
export function getEventBus(): EventBus {
    if (!globalThis.__eventBus) {
        globalThis.__eventBus = new EventBus();
    }

    return globalThis.__eventBus;
}
