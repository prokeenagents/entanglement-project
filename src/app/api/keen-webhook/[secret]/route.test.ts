import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GLOBAL_EVENT_KEY, getEventBus } from '@/service/events/event-bus';
import KeenConnector from '@/service/services/keen/keen.connector';
import { POST } from './route';

const SECRET = '6f1d4c0e8b2a49f7a3c5e9d1b7f0a2c4e6d8b0a1c3e5f7d9';

/** The connector surface the webhook drives, all spied. */
function fakeConnector() {
    return {
        acceptCertificate: vi.fn(async () => true),
        setCertificate: vi.fn(async () => {}),
        refreshCertificate: vi.fn(async () => {}),
        reconnect: vi.fn(async () => {}),
        setActive: vi.fn(),
        cache: { getAgentFrontSettingsKeys: () => [] },
        resources: {
            getSpaceList: vi.fn(async () => null),
            getConsumerContract: vi.fn(async () => null),
            getConsumerPolicy: vi.fn(async () => null),
            removeConsumerContract: vi.fn(),
            removeConsumerPolicy: vi.fn(),
            getAgentFrontSettings: vi.fn(async () => null)
        }
    };
}

const call = (secret: string, body: unknown) =>
    POST(new NextRequest(`http://site.test/api/keen-webhook/${secret}`, { method: 'POST', body: JSON.stringify(body) }), { params: Promise.resolve({ secret }) });

describe('POST /api/keen-webhook/[secret]', () => {
    let connector: ReturnType<typeof fakeConnector>;

    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
        process.env.KEEN_WEBHOOK_SECRET = SECRET;
        connector = fakeConnector();
        globalThis.__keenConnector = connector as unknown as KeenConnector;
    });

    afterEach(() => {
        delete process.env.KEEN_WEBHOOK_SECRET;
        globalThis.__keenConnector = undefined;
        vi.restoreAllMocks();
    });

    it.each([
        ['a forged r_cert', { 'synch-data': 'r_cert', result: { cert: '-----BEGIN CERTIFICATE-----', key: 'attacker' } }],
        ['a forced logout', { 'synch-data': ['r_consumer_logout'], consumer: { id: 'victim' } }],
        ['a contract delete (maintenance)', { 'synch-data': ['r_consumer_policy_delete'] }],
        ['a WAKE', { 'synch-data': ['r_api_keys'] }]
    ])('refuses %s without the secret and touches nothing', async (_label, body) => {
        const publish = vi.spyOn(getEventBus(), 'publish');

        const res = await call('wrong-secret', body);

        expect(res.status).toBe(401);
        expect(connector.acceptCertificate).not.toHaveBeenCalled();
        expect(connector.setCertificate).not.toHaveBeenCalled();
        expect(connector.reconnect).not.toHaveBeenCalled();
        expect(connector.resources.removeConsumerContract).not.toHaveBeenCalled();
        expect(publish).not.toHaveBeenCalled();
    });

    it('refuses everything when the server has no secret configured', async () => {
        delete process.env.KEEN_WEBHOOK_SECRET;

        const res = await call('', { 'synch-data': ['r_api_keys'] });

        expect(res.status).toBe(401);
        expect(connector.reconnect).not.toHaveBeenCalled();
    });

    it('hands r_cert material to acceptCertificate (never straight to setCertificate)', async () => {
        const res = await call(SECRET, { 'synch-data': 'r_cert', result: { cert: 'PEM', key: 'k' } });

        expect(res.status).toBe(200);
        expect(connector.acceptCertificate).toHaveBeenCalledWith('PEM', 'k');
        expect(connector.setCertificate).not.toHaveBeenCalled();
    });

    it('re-claims the certificate on an r_cert notice', async () => {
        await call(SECRET, { 'synch-data': ['r_cert'] });

        expect(connector.refreshCertificate).toHaveBeenCalledOnce();
    });

    it('still delivers a genuine consumer logout', async () => {
        const publish = vi.spyOn(getEventBus(), 'publish');

        await call(SECRET, { 'synch-data': ['r_consumer_logout'], consumer: { id: 'consumer-1' } });

        expect(publish).toHaveBeenCalledWith('consumer-1', expect.objectContaining({ type: 'logout', consumerId: 'consumer-1' }));
        expect(publish).not.toHaveBeenCalledWith(GLOBAL_EVENT_KEY, expect.anything());
    });
});
