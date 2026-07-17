import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '@/utils/cookies';

/**
 * Evaluate the session from the httpOnly cookies set at login:
 *  - authenticated: the refresh token exists and is a valid, unexpired RS256 JWT.
 *  - authorized:    the access token exists and is valid — AND authenticated.
 *
 * authorized can never be true while authenticated is false: a live access token
 * with a dead/missing refresh token is treated as logged-out (force re-auth).
 *
 * Both tokens are verified with the jose public key the connector imported from
 * the Keen certificate (globalThis.__keenConnector.publicKey) — the same key that
 * signed them. No key yet (cert not delivered) → nothing verifies → logged out.
 */
export async function checkLogin(request: NextRequest): Promise<App.Session.State> {
    const publicKey = globalThis.__keenConnector?.publicKey;

    if (!publicKey) {
        return { authorized: false, authenticated: false };
    }

    const accessToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    const refreshToken = request.cookies.get(REFRESH_TOKEN_COOKIE)?.value;

    const authenticated = await isValidJwt(refreshToken, publicKey);

    // authorized is gated behind authenticated per the rule.
    const authorized = authenticated && (await isValidJwt(accessToken, publicKey));

    return { authorized, authenticated };
}

async function isValidJwt(token: string | undefined, publicKey: CryptoKey): Promise<boolean> {
    if (!token) {
        return false;
    }

    try {
        // jwtVerify enforces the signature AND the `exp` claim (throws if expired).
        await jwtVerify(token, publicKey, { algorithms: ['RS256'] });
        return true;
    } catch {
        return false;
    }
}

export function checkPageAvailability() {
    const ready = globalThis.__keenConnector?.isReady || false;

    if (!ready) {
        return false;
    }

    const data = globalThis.__keenConnector?.cache.getConsumerContract() || null;
    if (!data || !data.result) {
        return false;
    }

    return true;
}
