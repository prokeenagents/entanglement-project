import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * Partner-side mirror of Keen's `token-crypto` (ms-auth-consumer / ms-relay).
 *
 * AES-256-GCM keyed off the per-certificate shared secret that arrives on the
 * r_cert webhook. It MUST stay algorithm-identical to Keen's copy — same HKDF
 * (`keen/consumer-<purpose>/v1`, 32-byte output), same 12-byte IV + 16-byte tag,
 * same base64url(iv || tag || ciphertext) layout — so a payload sealed on either
 * side opens on the other. Change one, change both.
 *
 * Runs in the Next server runtime only (the connector is a nodejs-runtime
 * singleton); node:crypto is unavailable on the edge.
 */

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

/**
 * The fallback when a certificate carries no secret. Fixed + weak on purpose: it
 * makes the seal reversible by anyone, so it is obfuscation, not protection. Must
 * match Keen's DEFAULT_SECRET exactly, or a default-keyed payload won't cross.
 */
const DEFAULT_SECRET = 'aaaaaaaaaaaaaaaa';

/**
 * Stretch the secret (16–32 chars, or the default) to a 32-byte AES-256 key. The
 * `purpose` domain-separates it: 'token' for the access/refresh payload, 'otp' for
 * the login OTP hash — a blob from one context can't open in the other.
 */
function deriveKey(secret: string, purpose: string): Buffer {
    const material = secret && secret.length > 0 ? secret : DEFAULT_SECRET;
    return Buffer.from(hkdfSync('sha256', Buffer.from(material, 'utf8'), Buffer.alloc(0), Buffer.from(`keen/consumer-${purpose}/v1`), KEY_LEN));
}

/** Encrypt `plaintext` → base64url(iv || tag || ciphertext). */
export function seal(plaintext: string, secret: string, purpose: string = 'token'): string {
    const key = deriveKey(secret, purpose);
    const iv = randomBytes(IV_LEN);
    const cipher = createCipheriv(ALGO, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64url');
}

/**
 * Reverse of `seal` — must use the SAME secret + purpose. Throws on a wrong key,
 * wrong purpose, or tampering (GCM verifies the tag at `final()`), so callers MUST
 * treat a throw as "reject" and never trust a half-decoded payload.
 */
export function open(blob: string, secret: string, purpose: string = 'token'): string {
    const raw = Buffer.from(blob, 'base64url');
    const key = deriveKey(secret, purpose);
    const decipher = createDecipheriv(ALGO, key, raw.subarray(0, IV_LEN));
    decipher.setAuthTag(raw.subarray(IV_LEN, IV_LEN + TAG_LEN));
    return Buffer.concat([decipher.update(raw.subarray(IV_LEN + TAG_LEN)), decipher.final()]).toString('utf8');
}
