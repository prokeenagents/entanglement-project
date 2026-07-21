import { NextRequest, NextResponse } from 'next/server';

import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken, setSessionCookies } from '@/utils/cookies';

/**
 * POST /api/consumer/update  —  body: { firstName, lastName, gender, dobDay, dobMonth, dobYear }
 *
 * Two-token bridge: the browser can't call Keen directly (the application_token
 * lives on the server-only connector, the access token is an httpOnly cookie), so
 * a consumer's profile edit round-trips through here. Partial update — the
 * connector forwards only the non-empty fields. Owner-scoped upstream by the
 * X-Access-Token, so a consumer can only ever edit their own profile.
 *
 * Registered in AUTH_API_CONFIG — the proxy 404s any /api/* path not listed there.
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        return NextResponse.json({ success: false, message: 'No session.' }, { status: 401 });
    }

    let body: Record<string, unknown>;

    try {
        body = (await request.json()) as Record<string, unknown>;
    } catch {
        return NextResponse.json({ success: false, message: 'Invalid JSON body.' }, { status: 400 });
    }

    const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
    const genderRaw = str(body.gender);
    const gender = genderRaw === 'male' || genderRaw === 'female' || genderRaw === 'other' ? genderRaw : undefined;

    const reply = await getKeen().consumer.update({
        accessToken,
        firstName: str(body.firstName),
        lastName: str(body.lastName),
        gender,
        dobDay: str(body.dobDay),
        dobMonth: str(body.dobMonth),
        dobYear: str(body.dobYear)
    });

    if (!reply) {
        return NextResponse.json({ success: false, message: 'Keen is unavailable.' }, { status: 502 });
    }

    // Narrow the two-token envelope: the success shape carries `success` + `message`,
    // the error shape carries `error` + `message[]`.
    if (!('success' in reply) || reply.success !== true) {
        const message = 'success' in reply ? reply.message : Array.isArray(reply.message) ? reply.message.join(', ') : reply.error;

        return NextResponse.json({ success: false, message }, { status: 400 });
    }

    const response = NextResponse.json({ success: true, message: reply.message });

    // Keen re-mints the session with the new profile claims baked in. Refresh the
    // httpOnly cookies so the next getConsumerData() (e.g. on the next navigation)
    // reads the updated values. If no fresh token came back, the change is still
    // persisted server-side — it just won't reflect in the token until next login.
    if (reply.result?.access_token) {
        return setSessionCookies(response, {
            accessToken: reply.result.access_token,
            refreshToken: reply.result.refresh_token
        });
    }

    return response;
}
