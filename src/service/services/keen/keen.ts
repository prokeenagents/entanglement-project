import KeenConnector from './keen.connector';

/**
 * Single source of the Keen connector across the whole Next process.
 *
 * Why globalThis: Next bundles instrumentation.ts separately from route
 * handlers, and dev HMR re-evaluates modules — so a plain module-level
 * `new KeenConnector()` would give each bundle its own instance. Stashing it
 * on globalThis (the real Node global) makes every bundle share ONE instance
 * and survives hot reloads. (Same pattern as the Prisma-in-Next singleton.)
 */

/**
 * Read the Keen credentials from the environment.
 *
 * These vars are UNPREFIXED (no `NEXT_PUBLIC_`), so they are server-only — Next
 * never bundles them into client code, which is exactly what a client secret
 * needs. Real values live in `.env.local` (gitignored); `.env.example` documents
 * the set. Never move these into `next.config` — its `env` key inlines values
 * into the client bundle.
 *
 * Throws LOUDLY at startup if any var is missing, rather than letting the
 * connector authenticate with `undefined` and fail every request silently. This
 * runs at server boot (via instrumentation → getKeen), so a missing var fails the
 * boot with a clear message instead of surfacing as mysterious 401s later.
 */
function readKeenConfig(): Keen.Connector {
    const config: Keen.Connector = {
        KEEN_HOST: process.env.KEEN_HOST ?? '',
        ORIGIN: process.env.KEEN_ORIGIN ?? '', // must be allow-listed on the api_key
        CLIENT_ID: process.env.KEEN_CLIENT_ID ?? '',
        CLIENT_SECRET: process.env.KEEN_CLIENT_SECRET ?? '',
        API_KEY_ID: process.env.KEEN_API_KEY_ID ?? '', // the api_key cuid (middle field of the base64)
        API_KEY_SECRET: process.env.KEEN_API_KEY_SECRET ?? ''
    };

    const missing = [
        ['KEEN_HOST', config.KEEN_HOST],
        ['KEEN_ORIGIN', config.ORIGIN],
        ['KEEN_CLIENT_ID', config.CLIENT_ID],
        ['KEEN_CLIENT_SECRET', config.CLIENT_SECRET],
        ['KEEN_API_KEY_ID', config.API_KEY_ID],
        ['KEEN_API_KEY_SECRET', config.API_KEY_SECRET]
    ]
        .filter(([, value]) => !value)
        .map(([name]) => name);

    if (missing.length > 0) {
        throw new Error(`Keen config missing from the environment: ${missing.join(', ')}. Copy .env.example → .env.local and fill it in.`);
    }

    return config;
}

/** The one shared KeenConnector. Created on first call, reused thereafter. */
export function getKeen(): KeenConnector {
    if (!globalThis.__keenConnector) {
        // DEV ONLY: the Keen edge is https://localhost behind a self-signed cert,
        // so Node would reject the TLS handshake. Disable verification before any fetch.

        const connector = new KeenConnector(readKeenConfig());
        globalThis.__keenConnector = connector;

        // Fire-and-forget: connect() retries every 2s forever until it gets a
        // token. Never awaited here — the token populates in the background and
        // callers guard on connector.isReady.
        void connector.connect();
    }
    return globalThis.__keenConnector;
}
