import { NextRequest, NextResponse } from 'next/server';

import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken } from '@/utils/cookies';

/**
 * GET /api/chat/history?chatId=<id>&limit=50&before=<createdAt>:<id>
 *
 * Two-token bridge (see /api/chat/list). `chatId` rides a query param rather
 * than a path segment because the proxy allow-list is an exact pathname match.
 * `before` is the cursor round-tripped from the previous page's nextCursor.
 */
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        return NextResponse.json({ success: false, status: 401, message: 'No session.' }, { status: 401 });
    }

    const params = request.nextUrl.searchParams;
    const chatId = params.get('chatId');

    if (!chatId) {
        return NextResponse.json({ success: false, status: 400, message: 'Missing chatId.' }, { status: 400 });
    }

    const limitRaw = Number(params.get('limit'));
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : undefined;
    const before = params.get('before') ?? undefined;

    const reply = await getKeen().consumer.getChatHistory({ accessToken, chatId, limit, before });

    if (!reply) {
        return NextResponse.json({ success: false, status: 502, message: 'Keen is unavailable.' }, { status: 502 });
    }

    return NextResponse.json(reply);
}
