import { NextResponse } from 'next/server';

import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken } from '@/utils/cookies';

/**
 * GET /api/chat/list
 *
 * The browser can't call Keen's chat surface directly: it's a two-token call
 * (application_token, held server-side by the connector + X-Access-Token, an
 * httpOnly cookie the browser can't read). So this handler is the bridge —
 * it reads the cookie, lets the connector attach the app token, and returns the
 * envelope verbatim.
 */
export const runtime = 'nodejs';

export async function GET() {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        return NextResponse.json({ success: false, status: 401, message: 'No session.' }, { status: 401 });
    }

    const reply = await getKeen().consumer.getChatList({ accessToken });

    if (!reply) {
        return NextResponse.json({ success: false, status: 502, message: 'Keen is unavailable.' }, { status: 502 });
    }

    return NextResponse.json(reply);
}
