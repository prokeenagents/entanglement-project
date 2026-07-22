'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { API_CONFIG } from '@/configs/api.config';
import { useAuth } from '@/contexts/auth';
import { useNotice } from '@/contexts/notice';

import { busHandler } from './handlers';

type EventHandler = (event: App.Events.Event) => void;

type EventsContextValue = {
    /**
     * Subscribe to server→client events. Returns an unsubscribe fn — call it in an
     * effect cleanup. Handlers fire for EVERY event; filter on `event.type` inside.
     */
    subscribe: (handler: EventHandler) => () => void;
};

const EventsContext = createContext<EventsContextValue | null>(null);

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/** Back-off after a failed poll before retrying, so a down server isn't hammered. */
const RETRY_DELAY_MS = 3000;

/**
 * The RECEIVER for the long-poll channel, as a context.
 *
 * It holds one long-poll loop against /api/events for the whole signed-in session
 * and fans each incoming event out to every subscriber. Any component under it can
 * `useEvents().subscribe(...)` to react to a push — the channel isn't hardcoded to a
 * single behaviour.
 *
 * It also has ONE built-in reaction: a `logout` event signs the user out (the loop
 * has `router` + the stop flag, so it awaits the logout before redirecting — no race
 * where /login bounces back because the cookie wasn't cleared yet).
 *
 * The loop re-polls immediately on a normal return (event or 25s empty timeout),
 * stops on 401 (session already gone), and backs off on transport errors. The
 * in-flight request is aborted on unmount so a route change doesn't leak a poll.
 */
export function EventsProvider({ children }: React.PropsWithChildren) {
    const router = useRouter();
    const { identity } = useAuth();
    const notice = useNotice();
    const userId = identity?.sub;
    const handlers = useRef<Set<EventHandler>>(new Set());

    const subscribe = useCallback((handler: EventHandler) => {
        handlers.current.add(handler);

        return () => {
            handlers.current.delete(handler);
        };
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        let stopped = false;

        const loop = async () => {
            while (!stopped) {
                try {
                    const res = await fetch(API_CONFIG.EVENTS.URL, { cache: 'no-store', signal: controller.signal });

                    if (stopped) {
                        return;
                    }

                    // No session (expired / signed out elsewhere) — stop; the proxy gates
                    // the next navigation anyway.
                    if (res.status === 401) {
                        return;
                    }

                    if (!res.ok) {
                        await sleep(RETRY_DELAY_MS);
                        continue;
                    }

                    const data = (await res.json()) as { events: App.Events.Event[] };

                    for (const event of data.events) {
                        // Component subscriptions (useEvents.subscribe) first…
                        for (const handler of [...handlers.current]) {
                            handler(event);
                        }

                        // …then the global handler index (one file per type, ./handlers).
                        // A handler may stop() the loop (e.g. logout) — bail once it has.
                        await busHandler(event, {
                            router,
                            userId,
                            notice,
                            stop: () => {
                                stopped = true;
                            }
                        });

                        if (stopped) {
                            return;
                        }
                    }

                    // Empty (timeout) or handled → re-poll immediately.
                } catch {
                    if (controller.signal.aborted) {
                        return;
                    }

                    await sleep(RETRY_DELAY_MS);
                }
            }
        };

        void loop();

        return () => {
            stopped = true;
            controller.abort();
        };
        // `notice` is a stable memo from NoticeProvider, so it never restarts the loop.
    }, [router, userId, notice]);

    const value = useMemo<EventsContextValue>(() => ({ subscribe }), [subscribe]);

    return <EventsContext.Provider value={value}>{children}</EventsContext.Provider>;
}

/**
 * Subscribe to server→client events. Throws outside an <EventsProvider>, so a
 * missing provider is a loud dev-time error rather than a silent null.
 */
export function useEvents(): EventsContextValue {
    const ctx = useContext(EventsContext);

    if (ctx === null) {
        throw new Error('useEvents must be used within an <EventsProvider>');
    }

    return ctx;
}
