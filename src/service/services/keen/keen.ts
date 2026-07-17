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

const KEEN_CONFIG: Keen.Connector = {
    KEEN_HOST: 'https://localhost',
    ORIGIN: 'http://192.168.68.120:3000', // must be allow-listed on the api_key
    CLIENT_ID: 'kcid_8-AJiMfgDwkYbOFD',
    CLIENT_SECRET: 'ksec_cJneSchf6UPsy4qlxegFrH26j4RGn-iSovdgQORmR2Q',
    API_KEY_ID: 'cmqtg4qkq00016mofbsevmt21', // the api_key cuid (middle field of the base64)
    API_KEY_SECRET: 'kak_2ouVleSNJl4gqkXxnEeOs5ZwM7zEygNLyMQcCW3K0js'
};

/** The one shared KeenConnector. Created on first call, reused thereafter. */
export function getKeen(): KeenConnector {
    if (!globalThis.__keenConnector) {
        // DEV ONLY: the Keen edge is https://localhost behind a self-signed cert,
        // so Node would reject the TLS handshake. Disable verification before any fetch.

        const connector = new KeenConnector(KEEN_CONFIG);
        globalThis.__keenConnector = connector;

        // Fire-and-forget: connect() retries every 2s forever until it gets a
        // token. Never awaited here — the token populates in the background and
        // callers guard on connector.isReady.
        void connector.connect();
    }
    return globalThis.__keenConnector;
}
