import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { RateLimiter } from '@/service/rate-limit/rate-limit';
import { proxyApi } from './proxy-api';
import { clientIp } from './request-guard';

const SITE = 'https://site.test';
const LOGGED_OUT: App.Session.State = { authorized: false, authenticated: false };

type Init = { method?: string; origin?: string | null; ip?: string; secFetchSite?: string };

function request(path: string, { method = 'POST', origin = SITE, ip = '203.0.113.7', secFetchSite }: Init = {}) {
    const headers = new Headers({ 'x-forwarded-for': ip, host: 'site.test' });
    if (origin !== null) {
        headers.set('origin', origin);
    }
    if (secFetchSite) {
        headers.set('sec-fetch-site', secFetchSite);
    }
    return new NextRequest(`${SITE}${path}`, { method, headers });
}

const status = async (path: string, init?: Init) => (await proxyApi(request(path, init), LOGGED_OUT, path)).status;

describe('proxyApi request guard', () => {
    beforeEach(() => {
        process.env.KEEN_ORIGIN = SITE;
        globalThis.__rateLimiter = new RateLimiter();
    });

    afterEach(() => {
        delete process.env.KEEN_ORIGIN;
        globalThis.__rateLimiter = undefined;
    });

    describe('CSRF / Origin check (1.8)', () => {
        it.each(['/api/login', '/api/otp', '/api/registration', '/api/reset-password', '/api/set-password', '/api/logout'])('refuses a cross-site POST to %s', async path => {
            expect(await status(path, { origin: 'https://evil.example' })).toBe(403);
        });

        it('refuses Origin: null (sandboxed iframe) and a cross-site fetch without Origin', async () => {
            expect(await status('/api/login', { origin: 'null' })).toBe(403);
            expect(await status('/api/login', { origin: null, secFetchSite: 'cross-site' })).toBe(403);
        });

        it('lets same-origin and non-browser callers through', async () => {
            expect(await status('/api/login')).toBe(200);
            expect(await status('/api/login', { origin: null })).toBe(200);
        });

        it("does not apply to Keen's server-to-server webhook", async () => {
            expect(await status('/api/keen-webhook/some-secret', { origin: 'https://keen.example' })).toBe(200);
        });
    });

    describe('rate limiting (1.8)', () => {
        it('answers 429 with Retry-After on the 11th login in a minute from one IP', async () => {
            for (let i = 0; i < 10; i++) {
                expect(await status('/api/login')).toBe(200);
            }

            const blocked = await proxyApi(request('/api/login'), LOGGED_OUT, '/api/login');
            expect(blocked.status).toBe(429);
            expect(Number(blocked.headers.get('retry-after'))).toBeGreaterThan(0);

            // Another IP is unaffected.
            expect(await status('/api/login', { ip: '198.51.100.9' })).toBe(200);
        });

        it('caps OTP guessing and email-sending routes', async () => {
            for (let i = 0; i < 10; i++) {
                await status('/api/otp');
            }
            expect(await status('/api/otp')).toBe(429);

            for (let i = 0; i < 5; i++) {
                await status('/api/registration');
            }
            expect(await status('/api/registration')).toBe(429);
        });

        it('limits the webhook by prefix, whatever the secret segment', async () => {
            for (let i = 0; i < 60; i++) {
                await status(`/api/keen-webhook/guess-${i}`);
            }
            expect(await status('/api/keen-webhook/guess-final')).toBe(429);
        });

        it('keys on the proxy-appended (rightmost) X-Forwarded-For entry, not a spoofed leftmost one', () => {
            const spoofed = new NextRequest(`${SITE}/api/login`, { method: 'POST', headers: { 'x-forwarded-for': '1.2.3.4, 203.0.113.7' } });
            expect(clientIp(spoofed)).toBe('203.0.113.7');
        });

        it('behind an external load balancer (TRUSTED_PROXY_HOPS=2) takes the client before its own IP', () => {
            process.env.TRUSTED_PROXY_HOPS = '2';
            try {
                const viaGoogle = (xff: string) => clientIp(new NextRequest(`${SITE}/api/login`, { method: 'POST', headers: { 'x-forwarded-for': xff } }));

                expect(viaGoogle('1.2.3.4, 203.0.113.7, 34.120.0.1')).toBe('203.0.113.7');
                expect(viaGoogle('203.0.113.7, 34.120.0.1')).toBe('203.0.113.7');
                expect(viaGoogle('203.0.113.7')).toBe('203.0.113.7');
            } finally {
                delete process.env.TRUSTED_PROXY_HOPS;
            }
        });
    });

    describe('expired session (5.4)', () => {
        it('answers 401 on a signed-in route without a session, 404 on an unknown one', async () => {
            expect(await status('/api/chat/list', { method: 'GET' })).toBe(401);
            expect(await status('/api/events', { method: 'GET' })).toBe(401);
            expect(await status('/api/consumer/profile', { method: 'GET' })).toBe(401);
            expect(await status('/api/does-not-exist', { method: 'GET' })).toBe(404);
        });
    });
});
