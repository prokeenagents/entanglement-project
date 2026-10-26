import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import KeenConnector from '@/service/services/keen/keen.connector';
import { POST } from './route';

const EMAIL = 'ana.ivanova@example.com';

describe('POST /api/login', () => {
    const logged: string[] = [];

    beforeEach(() => {
        logged.length = 0;
        const capture = (...args: unknown[]) => {
            logged.push(args.map(arg => (typeof arg === 'string' ? arg : JSON.stringify(arg))).join(' '));
        };
        vi.spyOn(console, 'log').mockImplementation(capture);
        vi.spyOn(console, 'warn').mockImplementation(capture);
        vi.spyOn(console, 'error').mockImplementation(capture);

        const getTokenPayload = vi.fn(async () => ({ sub: 'c1', email: EMAIL, space: 's1|s2', consumerContractKey: 'contract-key-19chars' }));
        globalThis.__keenConnector = {
            isReady: true,
            consumer: {
                getAccessToken: vi.fn(async () => ({ success: true, status: 200, result: { access_token: 'at', refresh_token: 'rt', expires_in: 900 } }))
            },
            tools: { getTokenPayload }
        } as unknown as KeenConnector;
    });

    afterEach(() => {
        globalThis.__keenConnector = undefined;
        vi.restoreAllMocks();
    });

    it('logs nothing personal on a successful sign-in, and keeps tokens out of the body', async () => {
        const res = await POST(
            new NextRequest('http://site.test/api/login', { method: 'POST', body: JSON.stringify({ email: EMAIL, password: 'oldpw' }) })
        );

        expect(res.status).toBe(200);
        expect(logged.join('\n')).not.toMatch(/ana\.ivanova|contract-key|s1\|s2/);

        const body = (await res.json()) as Record<string, unknown>;
        expect(JSON.stringify(body)).not.toMatch(/"at"|"rt"/);
        expect(res.cookies.get('refresh_token')?.httpOnly).toBe(true);
    });
});
