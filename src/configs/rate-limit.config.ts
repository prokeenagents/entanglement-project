const MINUTE = 60_000;

/**
 * Per-client-IP limits on the routes worth brute-forcing or flooding: sign-in,
 * the 6-digit OTP, the routes that make Keen send an email, and the Keen-facing
 * webhooks. Exact paths, except the webhook, whose last segment is the secret.
 */
export const RATE_LIMITS: Record<string, { limit: number; windowMs: number }> = {
    '/api/login': { limit: 10, windowMs: MINUTE },
    '/api/otp': { limit: 10, windowMs: MINUTE },
    '/api/registration': { limit: 5, windowMs: 15 * MINUTE },
    '/api/reset-password': { limit: 5, windowMs: 15 * MINUTE },
    '/api/set-password': { limit: 10, windowMs: 15 * MINUTE },
    '/api/consumer/reset-password': { limit: 5, windowMs: 15 * MINUTE },
    '/api/refresh': { limit: 30, windowMs: MINUTE },
    '/api/keen-webhook/': { limit: 60, windowMs: MINUTE },
    '/api/keen-callback': { limit: 60, windowMs: MINUTE }
};

export const WEBHOOK_PATH_PREFIX = '/api/keen-webhook/';
