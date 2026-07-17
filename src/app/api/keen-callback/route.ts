import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/keen-callback
 *
 * Receiver for Keen's consumer self-service completion callback. A partner
 * registers this URL as `X-Callback-Url` on a redeem/update request; after the
 * action lands, ms-consumer fires a fire-and-forget POST here with a per-action
 * body like `{ action, consumer, apikeyID, contractKey }`.
 *
 * For now it just accepts the POST, logs the body, and acks 200. The ack is
 * ignored upstream (the call is fire-and-forget), so any 2xx is fine.
 */

/**
 * THIS ONE IS WHEN WE GIVE A X-CALLBACK-URL TO KEEN API
 */
export async function POST(req: NextRequest) {
    let body: {
        'synch-data': string;
        result: string;
    } | null = null;

    try {
        body = (await req.json()) as unknown as {
            'synch-data': string;
            result: string;
        };

        console.log(body);
    } catch (err) {
        console.log(`[keen] Error: ${(err as Error).message}`);
    }

    return NextResponse.json({ success: true });
}
