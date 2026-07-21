'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

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

    const context = useMemo<App.Auth.ContextValue>(() => ({ identity, updateIdentity }), [identity, updateIdentity]);

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
