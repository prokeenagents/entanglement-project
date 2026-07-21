import { NextRequest, NextResponse } from 'next/server';

import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken } from '@/utils/cookies';

/**
 * POST /api/chat/title  —  body: { chatId, title }
 *
 * Two-token bridge (see /api/chat/list). Rename a chat. Ownership is enforced
 * upstream against the X-Access-Token's user, so a consumer can never rename
 * someone else's chat (it comes back as "Chat not found").
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        return NextResponse.json({ success: false, status: 401, message: 'No session.' }, { status: 401 });
    }

    let body: { chatId?: unknown; title?: unknown };

    try {
        body = (await request.json()) as { chatId?: unknown; title?: unknown };
    } catch {
        return NextResponse.json({ success: false, status: 400, message: 'Invalid JSON body.' }, { status: 400 });
    }

    const chatId = typeof body.chatId === 'string' ? body.chatId : '';
    const title = typeof body.title === 'string' ? body.title.trim() : '';

    if (!chatId || !title) {
        return NextResponse.json({ success: false, status: 400, message: 'chatId and title are required.' }, { status: 400 });
    }

    const reply = await getKeen().consumer.setChatTitle({ accessToken, chatId, title });

    if (!reply) {
        return NextResponse.json({ success: false, status: 502, message: 'Keen is unavailable.' }, { status: 502 });
    }

    return NextResponse.json(reply);
}
