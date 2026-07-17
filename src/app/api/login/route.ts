import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { formSchema } from '@/@schema/login';
import { setSessionCookies } from '@/utils/cookies';

/**
 * POST /api/login
 *
 * Server-side bridge for consumer login. The browser can't reach the Keen
 * connector directly (the singleton lives on the server, on globalThis), so the
 * useLogin() hook POSTs the credentials here; we drive KeenConsumer.getAccessToken
 * and hand the envelope back. Only the consumer's own access/refresh tokens leave
 * this process — the application_token stays server-side.
 *
 * The body is re-validated with the SAME `@schema/login` zod schema the form
 * uses — client validation is a UX affordance, not a trust boundary; anything
 * can POST here, so the schema is enforced again on the server.
 *
 * Pinned to the nodejs runtime so it can see the globalThis.__keenConnector
 * singleton that instrumentation.ts created at boot (the edge runtime can't).
 */
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json();

        const parsed = formSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ success: false, status: 400, message: 'Invalid credentials payload.', errors: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
        }

        const { email, password } = parsed.data;

        const keen = globalThis.__keenConnector;

        if (!keen || !keen.isReady) {
            return NextResponse.json({ success: false, status: 503, message: 'Keen connection is not ready.' }, { status: 503 });
        }

        const result = await keen.consumer.getAccessToken({ email, password });

        if (!result) {
            // null == the connector couldn't complete the round-trip (unreachable /
            // non-JSON / transport). A real credential rejection comes back as a
            // proper { success:false, status:406 } envelope, not null — so this is
            // an upstream/server problem, surfaced as 5xx (→ 'server-error' client-side).
            return NextResponse.json({ success: false, status: 502, message: 'Upstream did not return a valid response.' }, { status: 502 });
        }

        const envelope = result as unknown as App.Login.Envelope;
        const tokens = envelope.result;

        // Direct-token login: stash the tokens in httpOnly cookies and DO NOT echo
        // them back in the body — browser JS must never hold them. Subsequent
        // two-token consumer calls read these cookies server-side (this BFF is the
        // only thing that ever sees the raw tokens).
        if (envelope.success === true && tokens && 'access_token' in tokens) {
            // Read the sealed claims server-side (verify signature → open `hash`).
            // getTokenPayload is async, so it MUST be awaited; `keen` is already
            // narrowed non-null above. The tokens still go into httpOnly cookies
            // below — this is the decoded identity for any server-side use.
            const tokenPayload = await keen.tools.getTokenPayload(tokens.access_token);
            console.log('[login] token payload:', tokenPayload);

            const res = NextResponse.json({ success: true, status: 200, message: 'Success', isToken: true });

            return setSessionCookies(res, {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresIn: tokens.expires_in
            });
        }

        // OTP ("Verify" / result.hash) and rejections (success:false / 406) pass
        // through with isToken:false so the client branches on the flag, not the shape.
        return NextResponse.json({ ...envelope, isToken: false });
    } catch (err) {
        console.log(`[login] Error: ${(err as Error).message}`);
        return NextResponse.json({ success: false, status: 500, message: 'Internal error.' }, { status: 500 });
    }
}
