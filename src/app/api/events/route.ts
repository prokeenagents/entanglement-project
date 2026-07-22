import { NextResponse } from 'next/server';

import { GLOBAL_EVENT_KEY, getEventBus } from '@/service/events/event-bus';
import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken } from '@/utils/cookies';

/**
 * GET /api/events  —  the global server→client LONG POLL.
 *
 * The browser holds this request open; it resolves the instant an event is published
 * for this consumer (an org→site webhook lands → the bus wakes the poll), or after
 * ~25s with an empty list so the client immediately re-polls.
 *
 * Two channels, one poll: the caller's OWN consumer id (the access token's verified
 * `sub`) for targeted pushes, plus the broadcast key for org-wide changes. Targeted
 * events still can't cross users — the key is derived from the verified token, never
 * from the request — while the broadcast key carries only what is safe for everyone
 * (a "spaces changed, re-read them" ping, no payload).
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

    const events = await getEventBus().waitAny([consumerId, GLOBAL_EVENT_KEY], POLL_TIMEOUT_MS);

    return NextResponse.json({ events });
}
