import { NextResponse } from 'next/server';

/**
 * POST /api/keen-callback
 *
 * Receiver for Keen's consumer self-service completion callback. A partner
 * registers this URL as `X-Callback-Url` on a redeem/update request; after the
 * action lands, ms-consumer fires a fire-and-forget POST here with a per-action
 * body like `{ action, consumer, apikeyID, contractKey }`.
 *
 * It only acks 200. The body is never read or logged: it names the consumer and
 * the contract key, and nothing here acts on it. The ack is ignored upstream (the
 * call is fire-and-forget), so any 2xx is fine. The proxy rate-limits this path.
 */

/**
 * THIS ONE IS WHEN WE GIVE A X-CALLBACK-URL TO KEEN API
 */
export async function POST() {
    return NextResponse.json({ success: true });
}
