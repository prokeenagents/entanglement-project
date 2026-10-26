/**
 * Fixed-window, in-memory rate limiter for the proxy.
 *
 * Like the EventBus, it lives on `globalThis` (one instance across bundles and
 * HMR) and is SINGLE-NODE: each process counts on its own, so N instances allow
 * N× the limit. Back it with Redis `INCR` + `EXPIRE` to scale out.
 */

export type RateLimitDecision = { allowed: true } | { allowed: false; retryAfterSeconds: number };

type Bucket = { count: number; resetAt: number };

/** Prune expired buckets once the map grows past this, so it can't grow forever. */
const PRUNE_THRESHOLD = 10_000;

export class RateLimiter {
    private readonly buckets = new Map<string, Bucket>();

    /** Count one hit on `key`; refuse once `limit` hits land inside one `windowMs`. */
    hit(key: string, limit: number, windowMs: number, now: number = Date.now()): RateLimitDecision {
        if (this.buckets.size > PRUNE_THRESHOLD) {
            this.prune(now);
        }

        const current = this.buckets.get(key);
        const bucket = current && current.resetAt > now ? { ...current, count: current.count + 1 } : { count: 1, resetAt: now + windowMs };

        this.buckets.set(key, bucket);

        if (bucket.count > limit) {
            return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)) };
        }

        return { allowed: true };
    }

    private prune(now: number): void {
        for (const [key, bucket] of this.buckets) {
            if (bucket.resetAt <= now) {
                this.buckets.delete(key);
            }
        }
    }
}

declare global {
    var __rateLimiter: RateLimiter | undefined;
}

export function getRateLimiter(): RateLimiter {
    if (!globalThis.__rateLimiter) {
        globalThis.__rateLimiter = new RateLimiter();
    }

    return globalThis.__rateLimiter;
}
