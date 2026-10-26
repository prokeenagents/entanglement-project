import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import KeenConnector from '@/service/services/keen/keen.connector';
import { POST } from './route';

const PRISMA_ERROR =
    'Invalid `prisma.consumer.create()` invocation:\n\nUnique constraint failed on the fields: (`email`,`consumer_contract`)';

const body = {
    firstName: 'Ana',
    lastName: 'Ivanova',
    email: 'ana@example.com',
    password: 'Password1',
    confirmPassword: 'Password1',
    gender: 'female',
    consent: true,
    dob: '1990-05-17'
};

function withClaimReply(reply: unknown) {
    globalThis.__keenConnector = {
        isReady: true,
        props: { ORIGIN: 'https://site.test' },
        external: { registrationClaim: vi.fn(async () => reply) }
    } as unknown as KeenConnector;
}

const post = () => POST(new NextRequest('https://site.test/api/registration', { method: 'POST', body: JSON.stringify(body) }));

describe('POST /api/registration', () => {
    beforeEach(() => {
        vi.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        globalThis.__keenConnector = undefined;
        vi.restoreAllMocks();
    });

    it('never forwards a raw database error, and names the duplicate clearly (1.9)', async () => {
        withClaimReply({ success: false, status: 400, message: PRISMA_ERROR });

        const res = await post();
        const text = await res.text();

        expect(res.status).toBe(409);
        expect(text).not.toMatch(/prisma|constraint|consumer_contract|invocation/i);
        expect(JSON.parse(text).message).toMatch(/already exists/);
    });

    it('reduces any other internal-looking refusal to a safe message', async () => {
        withClaimReply({ message: ['ECONNREFUSED 10.0.0.12:5432'], error: 'Bad Request', statusCode: 400 });

        const res = await post();
        const json = (await res.json()) as { message: string };

        expect(res.status).toBe(400);
        expect(json.message).not.toContain('10.0.0.12');
    });

    it('rejects a password the server would refuse with a 400 and the rule, not a 502 (1.4)', async () => {
        withClaimReply({ success: true });

        const res = await POST(
            new NextRequest('https://site.test/api/registration', { method: 'POST', body: JSON.stringify({ ...body, password: 'password1', confirmPassword: 'password1' }) })
        );

        expect(res.status).toBe(400);
        expect(JSON.stringify(await res.json())).toContain('uppercase');
    });
});
