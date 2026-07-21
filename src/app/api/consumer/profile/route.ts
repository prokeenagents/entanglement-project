import { NextResponse } from 'next/server';

import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken } from '@/utils/cookies';

/**
 * GET /api/consumer/profile — two-token bridge to Keen's consumer profile read.
 *
 * Returns the caller's own editable profile (name / gender / dob) so the account
 * page can prefill. The browser can't call Keen directly (application_token lives
 * on the server-only connector; the access token is an httpOnly cookie), so it
 * round-trips through here. Owner-scoped upstream by the X-Access-Token.
 *
 * Registered in AUTH_API_CONFIG — the proxy 404s any /api/* path not listed there.
 */
export const runtime = 'nodejs';

export async function GET() {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        return NextResponse.json({ success: false, message: 'No session.' }, { status: 401 });
    }

    const reply = await getKeen().consumer.getProfile({ accessToken });

    if (!reply) {
        return NextResponse.json({ success: false, message: 'Keen is unavailable.' }, { status: 502 });
    }

    return NextResponse.json(reply);
}
