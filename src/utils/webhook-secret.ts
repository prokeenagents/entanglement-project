import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Shortest KEEN_WEBHOOK_SECRET readKeenConfig() accepts. `openssl rand -hex 32`
 * gives 64 chars; 32 is the floor so a short, guessable value fails the boot.
 */
export const MIN_WEBHOOK_SECRET_LENGTH = 32;

/**
 * Does the secret a webhook call carried match the configured one?
 *
 * Keen does not sign its webhooks, so the notification URL itself carries a shared
 * secret: `<origin>/api/keen-webhook/<KEEN_WEBHOOK_SECRET>`. Without it anyone who
 * can reach the site could POST a forged `r_cert` (swap the key that verifies every
 * session) or force-logout any consumer.
 *
 * Both sides are hashed to a fixed length before the constant-time compare, so the
 * comparison neither throws on a length mismatch nor leaks the length through
 * timing. An unset or too-short expected secret rejects everything: fail closed.
 */
export function isWebhookSecretValid(provided: string | null | undefined, expected: string | undefined): boolean {
    if (!expected || expected.length < MIN_WEBHOOK_SECRET_LENGTH || !provided) {
        return false;
    }

    const digest = (value: string) => createHash('sha256').update(value, 'utf8').digest();

    return timingSafeEqual(digest(provided), digest(expected));
}
