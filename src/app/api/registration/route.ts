import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { wireSchema } from '@/@schema/registration';
import { PAGE_CONFIG } from '@/configs/page.config';

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

        return NextResponse.json(result);
    } catch (err) {
        console.log(`[registration] Error: ${(err as Error).message}`);
        return NextResponse.json({ success: false, status: 500, message: 'Internal error.' }, { status: 500 });
    }
}
