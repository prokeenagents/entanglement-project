import { createCipheriv, hkdfSync, randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import { open, seal } from './keen.crypto';

/** What Keen produces for a certificate with no key: sealed with its public DEFAULT_SECRET. */
function sealWithPublicDefault(plaintext: string, purpose: string): string {
    const key = Buffer.from(hkdfSync('sha256', Buffer.from('aaaaaaaaaaaaaaaa', 'utf8'), Buffer.alloc(0), Buffer.from(`keen/consumer-${purpose}/v1`), 32));
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

describe('keen.crypto', () => {
    const secret = 'tenant-secret-0123456789abcdef';

    it('round-trips with the tenant secret and the same purpose', () => {
        expect(open(seal('hello', secret, 'otp'), secret, 'otp')).toBe('hello');
    });

    it('rejects a wrong purpose and a wrong key', () => {
        const blob = seal('hello', secret, 'token');
        expect(() => open(blob, secret, 'otp')).toThrow();
        expect(() => open(blob, 'another-secret-entirely-000000', 'token')).toThrow();
    });

    it('refuses to seal or open without a secret (no DEFAULT_SECRET fallback)', () => {
        expect(() => seal('hello', '', 'token')).toThrow(/No certificate secret key/);

        // A registration hash Keen sealed with its public default no longer opens here.
        const forgedOrWeak = sealWithPublicDefault('first|last|$argon2id$...|male|true|2000-01-01|a@b.c|key|cb|9999999999999', 'registration');
        expect(() => open(forgedOrWeak, '', 'registration')).toThrow(/No certificate secret key/);
    });
});
