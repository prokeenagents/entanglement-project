'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { API_CONFIG } from '@/configs/api.config';

/**
 * The signed-in consumer's IDENTITY (the access-token payload) as mutable client
 * state.
 *
 * The token is the source of truth: this is SEEDED on the server from
 * `getConsumerData().tokenPayload` in `(app)/layout.tsx`, and RE-SEEDED whenever the
 * server re-renders the layout (a navigation or `router.refresh()`) — which, after a
 * profile save, already carries the refreshed token cookie.
 *
 * Between those, `updateIdentity` patches it optimistically so the header shows a
 * new name the instant the /user page saves, instead of waiting for a round-trip.
 * The next server render reconciles it with the real token.
 */
const AuthContext = createContext<App.Auth.ContextValue | null>(null);

export function AuthProvider({ value, children }: { value: App.Auth.Identity | null; children: React.ReactNode }) {
    const [identity, setIdentity] = useState<App.Auth.Identity | null>(value);
    const [seeded, setSeeded] = useState<App.Auth.Identity | null>(value);

    // Re-seed from the server when the token payload changes. Done DURING render
    // (React's recommended "reset state on a prop change" pattern) rather than in an
    // effect, so it never lags a frame or trips the set-state-in-effect rule. A
    // client-side optimistic patch therefore lives only until the next server render.
    if (value !== seeded) {
        setSeeded(value);
        setIdentity(value);
    }

    const updateIdentity = useCallback((patch: Partial<App.Auth.Identity>) => {
        setIdentity(prev => (prev ? { ...prev, ...patch } : prev));
    }, []);

    /**
     * A rotation SPENDS the refresh token (the relay swaps it in its allow-list), so
     * two rotations in flight at once would send the second with an already-spent
     * token and get a bogus 401. Callers fire this from independent processes, so
     * they share one in-flight request instead of racing.
     */
    const inFlight = useRef<Promise<string | null> | null>(null);

    /**
     * Rotate the session via POST /api/refresh — the ONLY place that can do it, since
     * rotating needs the refresh_token, which is httpOnly and server-readable only.
     * The relay decides whether a rotation is actually due: when the current token
     * still has life it answers with its "still valid" fast-path and no new pair is
     * minted, so this is cheap to call unconditionally. Either way the route hands
     * back a token that is good right now (and re-mints the cookies when it rotated).
     */
    const checkAndRefreshToken = useCallback(async (): Promise<string | null> => {
        if (inFlight.current) {
            return inFlight.current;
        }

        const run = (async (): Promise<string | null> => {
            try {
                const res = await fetch(API_CONFIG.REFRESH.URL, { method: 'POST', cache: 'no-store' });
                const data = (await res.json()) as { success?: boolean; accessToken?: string };

                if (!res.ok || data.success !== true || !data.accessToken) {
                    return null;
                }

                return data.accessToken;
            } catch {
                // Transport failure — indistinguishable from a dead session to the
                // caller, and both mean "don't keep using the old token".
                return null;
            }
        })().finally(() => {
            inFlight.current = null;
        });

        inFlight.current = run;

        return run;
    }, []);

    const context = useMemo<App.Auth.ContextValue>(
        () => ({ identity, updateIdentity, checkAndRefreshToken }),
        [identity, updateIdentity, checkAndRefreshToken]
    );

    return <AuthContext.Provider value={context}>{children}</AuthContext.Provider>;
}

/**
 * Read the signed-in identity + the optimistic patch method. Throws outside an
 * <AuthProvider>, so a missing provider is a loud dev-time error rather than a
 * silent null.
 */
export function useAuth(): App.Auth.ContextValue {
    const ctx = useContext(AuthContext);

    if (ctx === null) {
        throw new Error('useAuth must be used within an <AuthProvider>');
    }

    return ctx;
}
