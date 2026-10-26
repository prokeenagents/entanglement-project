import { NextRequest, NextResponse } from 'next/server';

import { RATE_LIMITS, WEBHOOK_PATH_PREFIX } from '@/configs/rate-limit.config';
import { getRateLimiter } from '@/service/rate-limit/rate-limit';
import { apiError } from './api-error';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** The routes Keen's servers call. No browser is involved, so there is no Origin to check. */
export const isKeenInbound = (pathname: string): boolean => pathname.startsWith(WEBHOOK_PATH_PREFIX) || pathname === '/api/keen-callback';

/**
 * The caller's IP for rate limiting, from X-Forwarded-For. Proxies APPEND to that
 * header, so the leftmost entries are whatever the client chose to send; the client
 * as seen by our own proxy chain sits TRUSTED_PROXY_HOPS entries from the right:
 *   1 (default) — one proxy appends the client last: ngrok, nginx, and Cloud Run
 *                 (measured on the live service: it appends exactly the client IP);
 *   2           — an external HTTPS load balancer, which appends `<client>,<its own ip>`.
 * A list shorter than that falls back to its first entry. Exposed with no proxy at
 * all, every caller would share one bucket.
 */
export function clientIp(request: NextRequest): string {
    const entries = (request.headers.get('x-forwarded-for') ?? '')
        .split(',')
        .map(part => part.trim())
        .filter(Boolean);
    const hops = Math.max(1, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '1', 10) || 1);
    const client = entries.length >= hops ? entries[entries.length - hops] : entries[0];

    return client || request.headers.get('x-real-ip') || 'unknown';
}

const hostOf = (url: string | undefined): string | null => {
    try {
        return url ? new URL(url).host : null;
    } catch {
        return null;
    }
};

/**
 * Is this state-changing request coming from another site (CSRF)?
 *
 * SameSite=Lax alone still lets a sibling subdomain, or any site once cookie
 * attributes are relaxed, drive these routes. Browsers stamp every POST with
 * `Origin`, which a page cannot forge, so the Origin host must be this site:
 * the public KEEN_ORIGIN or the host the request was addressed to. Without an
 * Origin (non-browser clients) we fall back to `Sec-Fetch-Site`; a client
 * sending neither is not a browser, and CSRF needs a browser.
 */
export function isCrossSite(request: NextRequest): boolean {
    if (!UNSAFE_METHODS.has(request.method)) {
        return false;
    }

    const origin = request.headers.get('origin');

    if (origin === null) {
        return request.headers.get('sec-fetch-site') === 'cross-site';
    }

    const originHost = hostOf(origin);

    // `Origin: null` (sandboxed iframe, data: URL) or garbage is never ours.
    if (!originHost) {
        return true;
    }

    const ownHosts = [hostOf(process.env.KEEN_ORIGIN), request.headers.get('x-forwarded-host'), request.headers.get('host'), request.nextUrl.host];

    return !ownHosts.includes(originHost);
}

function rateLimitRuleKey(pathname: string): string | null {
    if (RATE_LIMITS[pathname]) {
        return pathname;
    }

    return pathname.startsWith(WEBHOOK_PATH_PREFIX) ? WEBHOOK_PATH_PREFIX : null;
}

/**
 * Runs before any other API handling. Returns the refusal to send, or null to
 * let the request through.
 */
export function guardApiRequest(request: NextRequest, pathname: string): NextResponse | null {
    if (!isKeenInbound(pathname) && isCrossSite(request)) {
        return apiError(403, 'Cross-site request refused.');
    }

    const ruleKey = rateLimitRuleKey(pathname);

    if (ruleKey) {
        const { limit, windowMs } = RATE_LIMITS[ruleKey];
        const decision = getRateLimiter().hit(`${ruleKey}|${clientIp(request)}`, limit, windowMs);

        if (!decision.allowed) {
            const res = apiError(429, 'Too many attempts. Please wait a moment and try again.');
            res.headers.set('Retry-After', String(decision.retryAfterSeconds));
            return res;
        }
    }

    return null;
}
