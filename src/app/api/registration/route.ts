import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { wireSchema } from '@/@schema/registration';
import { PAGE_CONFIG } from '@/configs/page.config';
import { clientEnvelope, isDuplicateAccount } from '@/utils/upstream-reply';

/**
 * POST /api/registration
 *
 * Claim leg of the logged-out ("outside") registration. The browser can't reach
 * the Keen connector directly (the singleton lives on the server), so the form
 * POSTs here and we drive KeenExternal.registrationClaim. NOTHING IS CREATED HERE:
 * Keen parks the details behind a hash and emails a verification link; the account
 * is created only when the consumer clicks it and the redeem leg runs. So a 200
 * means "we asked Keen to send a mail", never "registered".
 *
 * Re-validated with the SAME @schema/registration the form uses (passwords match,
 * consent ticked) — client validation is a UX affordance, not a trust boundary.
 *
 * nodejs runtime so it sees the globalThis.__keenConnector singleton.
 */
export const runtime = 'nodejs';

const DUPLICATE_ACCOUNT = 'An account with this email address already exists. Sign in, or use “Forgot password?” if you don’t remember the password.';

export async function POST(req: NextRequest) {
    try {
        const parsed = wireSchema.safeParse(await req.json());

        if (!parsed.success) {
            return NextResponse.json({ success: false, status: 400, message: 'Invalid registration payload.', errors: z.flattenError(parsed.error).fieldErrors }, { status: 400 });
        }

        const { firstName, lastName, email, password, gender, consent, dob } = parsed.data;

        const keen = globalThis.__keenConnector;

        if (!keen || !keen.isReady) {
            return NextResponse.json({ success: false, status: 503, message: 'Keen connection is not ready.' }, { status: 503 });
        }

        // Where the consumer LANDS from the emailed link. Built from the SERVER-side
        // ORIGIN, never the request — a URL that ends up in an email must not be
        // caller-influenced (a forged Host would phish our own consumer).
        const callbackUrl = `${keen.props.ORIGIN}${PAGE_CONFIG.CONFIRMATION.URL}`;

        const result = await keen.external.registrationClaim({ firstName, lastName, email, password, gender, consent, dob, callbackUrl });

        if (!result) {
            // null == transport failure. A genuine refusal (e.g. email in use) comes
            // back as a proper envelope, so this is an upstream/server problem → 5xx.
            return NextResponse.json({ success: false, status: 502, message: 'Upstream did not return a valid response.' }, { status: 502 });
        }

        if ((result as { success?: unknown }).success === true) {
            return NextResponse.json({ success: true, status: 200, message: 'Success' });
        }

        // Never forward Keen's raw refusal: it can be a database error naming tables
        // and constraints. A known duplicate gets a clear answer; anything else is
        // reduced to a short, safe message.
        if (isDuplicateAccount(result)) {
            return NextResponse.json({ success: false, status: 409, message: DUPLICATE_ACCOUNT }, { status: 409 });
        }

        const envelope = clientEnvelope(result, 'We could not start your registration. Please check your details and try again.');

        return NextResponse.json(envelope, { status: envelope.status >= 500 ? 502 : 400 });
    } catch (err) {
        console.log(`[registration] Error: ${(err as Error).message}`);
        return NextResponse.json({ success: false, status: 500, message: 'Internal error.' }, { status: 500 });
    }
}
