export {};

declare global {
    namespace App {
        namespace Auth {
            /** The signed-in consumer's identity — the access-token payload. */
            type Identity = Keen.AccessTokenPayload;

            interface ContextValue {
                /** The current identity, or null when signed out / before it's seeded. */
                identity: Identity | null;
                /**
                 * Patch the identity in place — e.g. a new `username` after a profile
                 * edit — so the UI (the header) reflects it immediately. Optimistic: the
                 * next server render re-seeds from the authoritative token.
                 */
                updateIdentity: (patch: Partial<Identity>) => void;
            }
        }
    }
}
