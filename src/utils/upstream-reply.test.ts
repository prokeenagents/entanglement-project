import { describe, expect, it } from 'vitest';

import { clientEnvelope, clientReply, isDuplicateAccount, publicMessage } from './upstream-reply';

describe('upstream-reply', () => {
    it('passes short plain messages and blocks internals', () => {
        expect(publicMessage('Invalid credentials', 'fallback')).toBe('Invalid credentials');
        expect(publicMessage(['email must be an email'], 'fallback')).toBe('email must be an email');
        expect(publicMessage('Invalid `prisma.consumer.create()` invocation', 'fallback')).toBe('fallback');
        expect(publicMessage('Error\n    at Object.<anonymous> (/srv/app.js:10:5)', 'fallback')).toBe('fallback');
        expect(publicMessage('x'.repeat(500), 'fallback')).toBe('fallback');
        expect(publicMessage(undefined, 'fallback')).toBe('fallback');
    });

    it('spots the duplicate-account database error', () => {
        expect(isDuplicateAccount({ message: 'Unique constraint failed on the fields: (`email`,`consumer_contract`)' })).toBe(true);
        expect(isDuplicateAccount({ message: 'Invalid credentials' })).toBe(false);
    });

    it('builds a safe envelope and keeps successful data intact', () => {
        expect(clientEnvelope({ success: false, statusCode: 406, message: ['Wrong password'] }, 'f')).toEqual({ success: false, status: 406, message: 'Wrong password' });

        const ok = { success: true, status: 200, message: 'OK', data: { items: [1] } };
        expect(clientReply(ok)).toBe(ok);
        expect(clientReply({ success: false, status: 500, message: 'PrismaClientKnownRequestError' })).toEqual({
            success: false,
            status: 500,
            message: 'The request could not be completed.'
        });
    });
});
