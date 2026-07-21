import { NextRequest, NextResponse } from 'next/server';

import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken } from '@/utils/cookies';

/**
 * POST /api/consumer/reset-password  —  body: { password }
 *
 * CLAIM leg of the LOGGED-IN password change (two-token). Reads the session from the
 * httpOnly cookie, resolves the user's own email from the VERIFIED token (never the
 * client — the relay requires the claim's email to be the token's own account), and
 * drives keen.consumer.resetPasswordClaim → Keen emails a confirm link to
 * /confirm-password/<hash>. NOTHING changes here; a 200 means "mail sent", not
 * "password changed".
 *
 * Registered in AUTH_API_CONFIG — the proxy 404s any /api/* path not listed there.
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        return NextResponse.json({ success: false, message: 'No session.' }, { status: 401 });
    }

    let body: { password?: unknown };

    try {
        body = (await request.json()) as { password?: unknown };
    } catch {
        return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
    }

    const password = typeof body.password === 'string' ? body.password : '';

    if (password.length < 8) {
        return NextResponse.json({ success: false, message: 'Password must be at least 8 characters.' }, { status: 400 });
    }

    const keen = getKeen();

    if (!keen.isReady) {
        return NextResponse.json({ success: false, message: 'Keen is unavailable.' }, { status: 503 });
    }

    // The claim's email must be the token's OWN account — resolve it from the verified
    // token, not the client.
    const payload = await keen.tools.getTokenPayload(accessToken);
    const email = payload?.email;

    if (!email) {
        return NextResponse.json({ success: false, message: 'Could not resolve your account.' }, { status: 401 });
    }

    // Where Keen links the confirm mail back to — from the SERVER origin, never the
    // request (a forged Host would phish our consumer). Keen appends /<hash>.
    const callbackUrl = `${keen.props.ORIGIN}/confirm-password`;

    const reply = await keen.consumer.resetPasswordClaim({ email, password, accessToken, callbackUrl });

    if (!reply) {
        return NextResponse.json({ success: false, message: 'Keen is unavailable.' }, { status: 502 });
    }

    const ok = 'success' in reply && reply.success === true;
    const message = 'success' in reply ? reply.message : Array.isArray(reply.message) ? reply.message.join(', ') : reply.error;

    return NextResponse.json({ success: ok, message }, { status: ok ? 200 : 400 });
}
