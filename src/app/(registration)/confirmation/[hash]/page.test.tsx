import { describe, expect, it, vi } from 'vitest';

const registrationRedeem = vi.fn();

vi.mock('@/utils/auth', () => ({ checkPageAvailability: () => true }));
vi.mock('@/service/services/keen/keen', () => ({
    getKeen: () => ({
        tools: { getRegistrationHashPayload: () => ({ callbackSecret: 'cb', expireIn: Date.now() + 60_000 }) },
        external: { registrationRedeem }
    })
}));

import Page from './page';

const render = async () => (await Page({ params: Promise.resolve({ hash: 'h' }) })) as { props: { title: string; message: string } };

describe('/confirmation/[hash]', () => {
    it('tells an already-registered person to sign in, without the database error (5.6, 1.9)', async () => {
        registrationRedeem.mockResolvedValueOnce({
            success: false,
            message: 'Invalid `prisma.consumer.create()` invocation: Unique constraint failed on the fields: (`email`,`consumer_contract`)'
        });

        const page = await render();

        expect(page.props.title).toBe('You already have an account');
        expect(JSON.stringify(page.props)).not.toMatch(/prisma|constraint/i);
    });

    it('keeps the neutral invalid/expired answer for other failures', async () => {
        registrationRedeem.mockResolvedValueOnce({ success: false, message: 'Hash already used' });

        const page = await render();

        expect(JSON.stringify(page.props)).toContain('invalid or has expired');
    });
});
