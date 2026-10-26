import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_CERTIFICATE_PEM } from '@/test/fixtures/certificate';
import KeenConnector from './keen.connector';

const PROPS: Keen.Connector = {
    KEEN_HOST: 'https://keen.test',
    ORIGIN: 'https://site.test',
    CLIENT_ID: 'kcid_test',
    CLIENT_SECRET: 'client-secret',
    API_KEY_ID: 'api-key-id',
    API_KEY_SECRET: 'api-key-secret'
};

const SECRET_KEY = 'a-real-tenant-secret-key-32-char';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Answers the application token, the certificate claim (GET) with a code, and the redeem (POST) with a plain ack. */
const keenEndpoints = (appToken = 'app-token') =>
    vi.fn(async (url: string, init?: RequestInit) => {
        if (url.includes('application_token')) {
            return json({ success: true, result: { access_token: appToken } });
        }
        return init?.method === 'GET' ? json({ success: true, result: { code: 'claim-code' } }) : json({ success: true });
    });

/** A connector holding an application token, as after boot. */
async function connectedConnector(): Promise<KeenConnector> {
    const connector = new KeenConnector(PROPS);
    await connector.fetchApplicationToken();
    return connector;
}

describe('KeenConnector certificate handling', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'warn').mockImplementation(() => {});
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('drops certificate material when no redeem is outstanding (forged r_cert)', async () => {
        const connector = new KeenConnector(PROPS);

        await expect(connector.acceptCertificate(TEST_CERTIFICATE_PEM, SECRET_KEY)).resolves.toBe(false);
        expect(connector.certificate).toBe('');
        expect(connector.publicKey).toBeNull();
    });

    it('accepts the material once, right after its own redeem, and never twice', async () => {
        vi.stubGlobal('fetch', keenEndpoints());
        const connector = await connectedConnector();

        await connector.refreshCertificate();

        await expect(connector.acceptCertificate(TEST_CERTIFICATE_PEM, SECRET_KEY)).resolves.toBe(true);
        expect(connector.certificate).toBe(TEST_CERTIFICATE_PEM);
        expect(connector.publicKey).not.toBeNull();

        // A second delivery for the same redeem — a replay or a forgery — is refused.
        await expect(connector.acceptCertificate('-----BEGIN CERTIFICATE-----\nforged', 'attacker-key')).resolves.toBe(false);
        expect(connector.certificate).toBe(TEST_CERTIFICATE_PEM);
        expect(connector.secretKey).toBe(SECRET_KEY);
    });

    it('closes the window once it expires', async () => {
        vi.stubGlobal('fetch', keenEndpoints());
        const connector = await connectedConnector();
        await connector.refreshCertificate();

        vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 61_000);

        await expect(connector.acceptCertificate(TEST_CERTIFICATE_PEM, SECRET_KEY)).resolves.toBe(false);
    });

    it('refuses a certificate that has no shared secret key (no DEFAULT_SECRET fallback)', async () => {
        const connector = new KeenConnector(PROPS);

        await connector.setCertificate(TEST_CERTIFICATE_PEM, '');

        expect(connector.certificate).toBe('');
        expect(connector.publicKey).toBeNull();
        expect(() => connector.seal('payload')).toThrow();
    });

    it('re-claims a code on refreshCertificate even after a previous handshake (r_cert was a no-op)', async () => {
        const fetchMock = keenEndpoints();
        vi.stubGlobal('fetch', fetchMock);
        const connector = await connectedConnector();

        await connector.refreshCertificate();
        await connector.refreshCertificate();

        const claims = fetchMock.mock.calls.filter(([, init]) => init?.method === 'GET');
        expect(claims).toHaveLength(2);
    });

    it('logs only the HTTP status of the certificate redeem, never its body', async () => {
        vi.stubGlobal(
            'fetch',
            vi.fn(async (url: string, init?: RequestInit) => {
                if (url.includes('application_token')) {
                    return json({ success: true, result: { access_token: 'app-token' } });
                }
                return init?.method === 'GET' ? json({ result: { code: 'claim-code' } }) : json({ success: true, result: { tenant: 'sensitive-redeem-detail' } });
            })
        );
        const log = vi.spyOn(console, 'log');
        const connector = await connectedConnector();

        await connector.refreshCertificate();

        const lines = log.mock.calls.map(args => args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
        expect(lines.some(line => line.includes('Certificate redeem → HTTP 200'))).toBe(true);
        expect(lines.join('\n')).not.toContain('sensitive-redeem-detail');
    });

    it('keeps the current certificate while a WAKE reconnect runs', async () => {
        vi.stubGlobal('fetch', keenEndpoints());
        const connector = await connectedConnector();
        await connector.refreshCertificate();
        await connector.acceptCertificate(TEST_CERTIFICATE_PEM, SECRET_KEY);

        // Token renewal + re-claim + resources, all answered.
        vi.stubGlobal('fetch', keenEndpoints('fresh-app-token'));

        await connector.reconnect();

        expect(connector.certificate).toBe(TEST_CERTIFICATE_PEM);
        expect(connector.publicKey).not.toBeNull();
        expect(connector.isReady).toBe(true);
        expect(connector.token).toBe('fresh-app-token');
    });
});
