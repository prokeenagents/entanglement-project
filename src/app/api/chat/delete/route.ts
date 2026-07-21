import { NextRequest, NextResponse } from 'next/server';

import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken } from '@/utils/cookies';

/**
 * POST /api/chat/delete  —  body: { chatId }
 *
 * Two-token bridge (see /api/chat/list). This is a SOFT delete: upstream sets
 * `archived = true` and never hard-deletes, so the chat simply vanishes from
 * list/search and history refuses it. Owner-scoped.
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        return NextResponse.json({ success: false, status: 401, message: 'No session.' }, { status: 401 });
    }

    let body: { chatId?: unknown };

    try {
        body = (await request.json()) as { chatId?: unknown };
    } catch {
        return NextResponse.json({ success: false, status: 400, message: 'Invalid JSON body.' }, { status: 400 });
    }

    const chatId = typeof body.chatId === 'string' ? body.chatId : '';

    if (!chatId) {
        return NextResponse.json({ success: false, status: 400, message: 'chatId is required.' }, { status: 400 });
    }

    const reply = await getKeen().consumer.deleteChat({ accessToken, chatId });

    if (!reply) {
        return NextResponse.json({ success: false, status: 502, message: 'Keen is unavailable.' }, { status: 502 });
    }

    return NextResponse.json(reply);
}
