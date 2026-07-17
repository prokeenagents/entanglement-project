import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { formSchema } from '@/@schema/reset-password';
import { PAGE_CONFIG } from '@/configs/page.config';

/**
 * POST /api/reset-password
 *
 * First leg ("claim") of the LOGGED-OUT password reset. The browser can't reach
 * the Keen connector directly (the singleton lives on the server, on globalThis),
 * so the reset form POSTs here and we drive KeenExternal.resetPasswordClaim on its
 * behalf. The application_token never leaves this process.
 *
 * NOTHING IS APPLIED HERE. Keen parks { email, newPassword } behind a hash and
 * emails the consumer a link; the password only changes when they click it and the
 * redeem leg runs. So a 200 from this route means "we asked Keen to send a mail",
 * never "the password is changed".
 *
 * This is KeenExternal (application-token only), NOT KeenConsumer — the consumer
 * is logged out and has no access token. The identically-named
 * KeenConsumer.resetPasswordClaim hits /consumer/auth-reset-password-claim and is
 * the signed-in variant.
 *
 * The body is re-validated with the SAME `@schema/reset-password` zod schema the
 * form uses — client validation is a UX affordance, not a trust boundary; anything
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
            return NextResponse.json({ success: false, status: 400, message: 'Invalid reset payload.', errors: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
        }

        const { email, password } = parsed.data;

        const keen = globalThis.__keenConnector;

        if (!keen || !keen.isReady) {
            return NextResponse.json({ success: false, status: 503, message: 'Keen connection is not ready.' }, { status: 503 });
        }

        // Where the consumer LANDS from the emailed link. On a CLAIM leg
        // X-Callback-Url means "email-link target" (required); it only means
        // "completion ping" on redeem/update — that is what /api/keen-callback serves.
        //
        // Built from the SERVER-side configured ORIGIN, deliberately NOT from this
        // request: req.nextUrl.origin follows the Host header, so a caller could POST
        // here with a forged Host and have Keen mail our consumer a link pointing at
        // their own domain — a ready-made credential-phishing vector. A URL that ends
        // up in an email must never be caller-influenced.
        const callbackUrl = `${keen.props.ORIGIN}${PAGE_CONFIG.SET_PASSWORD.URL}`;

        const result = await keen.external.resetPasswordClaim({ email, password, callbackUrl });

        if (!result) {
            // null == the connector couldn't complete the round-trip (unreachable /
            // non-JSON / transport). A genuine refusal comes back as a proper
            // { success:false } envelope, not null — so this is an upstream/server
            // problem, surfaced as 5xx (→ 'server-error' client-side).
            return NextResponse.json({ success: false, status: 502, message: 'Upstream did not return a valid response.' }, { status: 502 });
        }

        return NextResponse.json(result);
    } catch (err) {
        console.log(`[reset-password] Error: ${(err as Error).message}`);
        return NextResponse.json({ success: false, status: 500, message: 'Internal error.' }, { status: 500 });
    }
}
