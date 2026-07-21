import { NextResponse } from 'next/server';

import { getEventBus } from '@/service/events/event-bus';
import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken } from '@/utils/cookies';

/**
 * GET /api/events  —  the global server→client LONG POLL.
 *
 * The browser holds this request open; it resolves the instant an event is published
 * for this consumer (an org→site webhook lands → the bus wakes the poll), or after
 * ~25s with an empty list so the client immediately re-polls.
 *
 * Scoped to the caller's OWN consumer id (the access token's verified `sub`), so a
 * user can only ever receive their own events — never force another user's browser.
 *
 * Registered in AUTH_API_CONFIG — the proxy 404s any /api/* path not listed there.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const POLL_TIMEOUT_MS = 25_000;

export async function GET() {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        return NextResponse.json({ events: [] }, { status: 401 });
    }

    const payload = await getKeen().tools.getTokenPayload(accessToken);
    const consumerId = payload?.sub;

    if (!consumerId) {
        return NextResponse.json({ events: [] }, { status: 401 });
    }

    const events = await getEventBus().wait(consumerId, POLL_TIMEOUT_MS);

    return NextResponse.json({ events });
}
