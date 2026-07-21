import { NextRequest, NextResponse } from 'next/server';

import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken } from '@/utils/cookies';

/**
 * GET /api/chat/search?q=<term>&limit=150
 *
 * Two-token bridge (see /api/chat/list). Case-insensitive substring match over
 * the consumer's own active chat titles; archived chats are excluded upstream.
 */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        return NextResponse.json({ success: false, status: 401, message: 'No session.' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const query = params.get('q');

    if (!query) {
        return NextResponse.json({ success: false, status: 400, message: 'Missing search query.' }, { status: 400 });
    }

    const limitRaw = Number(params.get('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;

    const reply = await getKeen().consumer.searchChats({ accessToken, query, limit });

    if (!reply) {
        return NextResponse.json({ success: false, status: 502, message: 'Keen is unavailable.' }, { status: 502 });
    }

    return NextResponse.json(reply);
}
