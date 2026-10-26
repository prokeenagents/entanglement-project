'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';

import { API_CONFIG } from '@/configs/api.config';
import { useAuth } from '@/contexts/auth';
import { useConsumer } from '@/contexts/consumer';
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
 *
 * PAUSED while the tab is hidden: the held request is aborted and no new one starts
 * until the tab is visible again. On Cloud Run a held request keeps the instance
 * running (and billed), so a forgotten background tab must not hold one. Nothing
 * targeted is lost meanwhile — the server queues a consumer's events until its next
 * poll — but a broadcast is handed to whichever tab polls first, and a restarted
 * instance starts with an empty queue. So the first thing a returning tab does is
 * `router.refresh()`: the server re-renders spaces, agents and settings from its
 * webhook-fed cache, which covers anything it missed.
 */
export function EventsProvider({ children }: React.PropsWithChildren) {
    const router = useRouter();
    const { identity } = useAuth();
    const notice = useNotice();
    const { demo } = useConsumer();
    const userId = identity?.sub;
    const handlers = useRef<Set<EventHandler>>(new Set());

    const subscribe = useCallback((handler: EventHandler) => {
        handlers.current.add(handler);

        return () => {
            handlers.current.delete(handler);
        };
    }, []);

    useEffect(() => {
        // Demo mode has no session to push to (utils/demo.ts) — don't poll.
        if (demo) {
            return;
        }

        let controller = new AbortController();
        let stopped = false;
        let wake: (() => void) | null = null;

        const isHidden = () => document.visibilityState === 'hidden';

        // Hidden → drop the held poll; visible again → resume the paused loop.
        const onVisibilityChange = () => {
            if (isHidden()) {
                controller.abort();
                return;
            }

            wake?.();
        };

        const loop = async () => {
            while (!stopped) {
                if (isHidden()) {
                    await new Promise<void>(resolve => {
                        wake = resolve;
                    });
                    wake = null;

                    if (stopped) {
                        return;
                    }

                    // Back from a pause — re-read whatever was broadcast meanwhile.
                    router.refresh();
                }

                controller = new AbortController();

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
                    if (stopped) {
                        return;
                    }

                    // Aborted because the tab went hidden — loop round into the pause.
                    if (controller.signal.aborted) {
                        continue;
                    }

                    await sleep(RETRY_DELAY_MS);
                }
            }
        };

        document.addEventListener('visibilitychange', onVisibilityChange);
        void loop();

        return () => {
            stopped = true;
            document.removeEventListener('visibilitychange', onVisibilityChange);
            controller.abort();
            wake?.();
        };
        // `notice` is a stable memo from NoticeProvider, so it never restarts the loop.
    }, [router, userId, notice, demo]);

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
