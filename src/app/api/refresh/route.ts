import { NextResponse } from 'next/server';

import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken, getRefreshToken, setSessionCookies } from '@/utils/cookies';

/**
 * POST /api/refresh
 *
 * Rotate the consumer session and hand the fresh access token back to the caller.
 *
 * Why this exists: the relay verifies `userContext.accessToken` on EVERY chat run
 * frame and rejects an expired one with `E3002` — WITHOUT closing the socket, since
 * the WS lifetime is bound to the cid, not the token. The chat SDK is built for
 * that (its `accessToken` is mutable via `setAccessToken()` so a refresh lands on
 * the next send without a reconnect) but it cannot refresh itself: rotating needs
 * the refresh_token, which is httpOnly and only the server can read. So the client
 * calls here on E3002, then `setAccessToken(reply.accessToken)` and retries.
 *
 * Unlike /api/login this DOES return the access token in the body — the browser
 * genuinely needs it to stamp WS frames, and it already holds the same value via
 * the consumer context, so this is no new exposure. The refresh_token is NEVER
 * echoed; it only ever moves between the cookie and Keen.
 */
export const runtime = 'nodejs';

type RotateEnvelope = {
    success?: boolean;
    statusCode?: number;
    message?: string;
    result?: {
        access_token: string;
        refresh_token: string;
        expires_in: number;
    };
};

export async function POST() {
    const accessToken = await getAccessToken();
    const refreshToken = await getRefreshToken();

    // No refresh cookie = nothing to rotate from. This is a real "sign in again",
    // not a transient failure, so say 401 and let the caller bounce to /login.
    if (!refreshToken) {
        return NextResponse.json({ success: false, status: 401, message: 'No refresh token.' }, { status: 401 });
    }

    const reply = await getKeen().consumer.rotateToken({ token: accessToken ?? '', refreshToken });

    if (!reply) {
        return NextResponse.json({ success: false, status: 502, message: 'Upstream did not return a valid response.' }, { status: 502 });
    }

    const envelope = reply as RotateEnvelope;

    // A rejected rotation means the refresh token is spent/revoked/expired — the
    // session is genuinely over.
    if (envelope.success !== true) {
        return NextResponse.json({ success: false, status: 401, message: 'Session expired.' }, { status: 401 });
    }

    /**
     * Fast path. When the CURRENT access token still validates, the relay answers
     * `{ success: true, statusCode: 100, message: 'Token is still valid!' }` with NO
     * result — it deliberately doesn't re-mint a pair that has life left. There's
     * nothing to write; hand back the token we already have so the caller can
     * `setAccessToken()` unconditionally and not branch on this.
     */
    if (!envelope.result?.access_token) {
        return NextResponse.json({ success: true, status: 200, message: 'Token is still valid', accessToken });
    }

    const res = NextResponse.json({
        success: true,
        status: 200,
        message: 'Success',
        accessToken: envelope.result.access_token
    });

    return setSessionCookies(res, {
        accessToken: envelope.result.access_token,
        refreshToken: envelope.result.refresh_token,
        expiresIn: envelope.result.expires_in
    });
}
