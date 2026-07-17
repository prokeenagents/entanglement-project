import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { formSchema } from '@/@schema/otp';
import { setSessionCookies } from '@/utils/cookies';

/**
 * POST /api/otp
 *
 * Server-side bridge for the OTP ("Verify") second factor. After /api/login
 * returns a Verify envelope (isToken:false, result.hash), the client shows the
 * PIN form and POSTs { pin, token } here — `token` is the `hash` from that login
 * reply. We drive KeenConsumer.sendOtp and, on success, stash the returned
 * tokens as httpOnly cookies exactly like /api/login. Only the consumer's own
 * tokens leave this process — the application_token stays server-side.
 *
 * The form only captures the 6-digit `pin`; the `token` (hash) is added by the
 * client from the login step, so the wire body is re-validated as pin + token.
 *
 * Pinned to the nodejs runtime so it can see the globalThis.__keenConnector
 * singleton that instrumentation.ts created at boot (the edge runtime can't).
 */
export const runtime = 'nodejs';

const bodySchema = formSchema.extend({
    token: z.string().min(1, { error: 'Missing OTP token.' })
});

export async function POST(req: NextRequest) {
    try {
        const body: unknown = await req.json();

        const parsed = bodySchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ success: false, status: 400, message: 'Invalid OTP payload.', errors: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
        }

        const { pin, token } = parsed.data;

        const tokenPayload = await globalThis.__keenConnector?.tools.getOtpPayload(token);

        if (!tokenPayload) {
            throw new Error('error');
        }

        const keen = globalThis.__keenConnector;

        if (!keen || !keen.isReady) {
            return NextResponse.json({ success: false, status: 503, message: 'Keen connection is not ready.' }, { status: 503 });
        }

        const result = await keen.consumer.sendOtp({ pin, token });

        if (!result) {
            // null == the connector couldn't complete the round-trip (unreachable /
            // non-JSON / transport). A real PIN rejection comes back as a proper
            // { success:false } envelope, not null — so this is an upstream/server
            // problem, surfaced as 5xx (→ 'server-error' client-side).
            return NextResponse.json({ success: false, status: 502, message: 'Upstream did not return a valid response.' }, { status: 502 });
        }

        const envelope = result as unknown as App.Login.Envelope;
        const tokens = envelope.result;

        // OTP confirmed → tokens are returned; stash them in httpOnly cookies and DO
        // NOT echo them back. isToken:true tells the client "you're in, redirect".
        if (envelope.success === true && tokens && 'access_token' in tokens) {
            const res = NextResponse.json({ success: true, status: 200, message: 'Success', isToken: true });

            return setSessionCookies(res, {
                accessToken: tokens.access_token,
                refreshToken: tokens.refresh_token,
                expiresIn: tokens.expires_in
            });
        }

        // Bad PIN / expired hash / rejection — pass through with isToken:false so the
        // client branches on the flag, not the shape.
        return NextResponse.json({ ...envelope, isToken: false });
    } catch (err) {
        console.log(`[otp] Error: ${(err as Error).message}`);
        return NextResponse.json({ success: false, status: 500, message: 'Internal error.' }, { status: 500 });
    }
}
