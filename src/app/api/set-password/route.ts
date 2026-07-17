import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

/**
 * POST /api/set-password
 *
 * Redeem leg of the logged-out password reset. The browser posts only the `hash`
 * from the /set-password/<hash> link; everything sensitive stays server-side.
 *
 * We open the sealed hash with the tenant secret (validates it + not expired +
 * lifts the callbackSecret), then drive KeenExternal.resetPasswordRedeem — which
 * sends X-Hash + X-Callback-Secret to Keen, where the relay re-opens the hash,
 * checks the callbackSecret matches, consumes the single-use grant, and applies
 * the password that was argon-hashed into the canonical at CLAIM time.
 *
 * The argon password + callbackSecret never reach the client — they're read out
 * of the hash here and forwarded to Keen. On any failure we return the same
 * "invalid or expired" envelope so the page can't distinguish failure modes.
 *
 * nodejs runtime so it sees the globalThis.__keenConnector singleton.
 */
export const runtime = 'nodejs';

const bodySchema = z.object({
    hash: z.string().min(1, { error: 'Missing reset hash.' })
});

const INVALID_OR_EXPIRED = 'This password reset link is invalid or has expired. Please request a new one.';

export async function POST(req: NextRequest) {
    try {
        const parsed = bodySchema.safeParse(await req.json());

        if (!parsed.success) {
            return NextResponse.json({ success: false, status: 400, message: INVALID_OR_EXPIRED }, { status: 400 });
        }

        const { hash } = parsed.data;

        const keen = globalThis.__keenConnector;

        if (!keen || !keen.isReady) {
            return NextResponse.json({ success: false, status: 503, message: 'Keen connection is not ready.' }, { status: 503 });
        }

        // Open server-side to validate + lift the callbackSecret. Null → bad key /
        // tamper / wrong shape; expireIn is a ms deadline from claim time.
        const payload = keen.tools.getResetPasswordHashPayload(hash);

        if (!payload || payload.expireIn < Date.now()) {
            return NextResponse.json({ success: false, status: 400, message: INVALID_OR_EXPIRED }, { status: 400 });
        }

        const result = await keen.external.resetPasswordRedeem({ hash, callbackSecret: payload.callbackSecret });

        // A genuine success comes back as { success: true }; null (transport) or a
        // success:false envelope both collapse to the neutral invalid/expired reply.
        if (!result || (result as { success?: boolean }).success !== true) {
            return NextResponse.json({ success: false, status: 400, message: INVALID_OR_EXPIRED }, { status: 400 });
        }

        return NextResponse.json({ success: true, status: 200, message: 'Success' });
    } catch (err) {
        console.log(`[set-password] Error: ${(err as Error).message}`);
        return NextResponse.json({ success: false, status: 500, message: 'Internal error.' }, { status: 500 });
    }
}
