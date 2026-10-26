import { describe, expect, it } from 'vitest';

import { isWebhookSecretValid } from './webhook-secret';

const SECRET = '6f1d4c0e8b2a49f7a3c5e9d1b7f0a2c4e6d8b0a1c3e5f7d9';

describe('isWebhookSecretValid', () => {
    it('accepts only the exact secret', () => {
        expect(isWebhookSecretValid(SECRET, SECRET)).toBe(true);
        expect(isWebhookSecretValid(`${SECRET}x`, SECRET)).toBe(false);
        expect(isWebhookSecretValid(SECRET.slice(0, -1), SECRET)).toBe(false);
        expect(isWebhookSecretValid('', SECRET)).toBe(false);
        expect(isWebhookSecretValid(undefined, SECRET)).toBe(false);
    });

    it('fails closed when the server has no secret, or a short one', () => {
        expect(isWebhookSecretValid('anything', undefined)).toBe(false);
        expect(isWebhookSecretValid('', '')).toBe(false);
        expect(isWebhookSecretValid('short', 'short')).toBe(false);
    });
});
