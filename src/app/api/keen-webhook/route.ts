import { NextRequest, NextResponse } from 'next/server';

/**
 * Narrow the webhook's `result` to the { cert, key } material. Anything else —
 * the legacy bare-PEM string, a null, a partial object — is refused rather than
 * coerced, so a shape change upstream surfaces as "no certificate received"
 * instead of a silently corrupt one.
 */
const isCertificateMaterial = (result: unknown): result is Keen.Webhook.CertificateMaterial => {
    if (typeof result !== 'object' || result === null) {
        return false;
    }

    const material = result as Partial<Keen.Webhook.CertificateMaterial>;

    return typeof material.cert === 'string' && typeof material.key === 'string' && material.cert !== '';
};

/**
 * POST /api/keen-webhook
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
 * THIS ONE IS CALLED BY THE ORGANIZATION
 */
export async function POST(req: NextRequest) {
    let body: Keen.Webhook.Payload | null = null;

    try {
        body = (await req.json()) as unknown as Keen.Webhook.Payload;

        if (!globalThis.__keenConnector) {
            return;
        }

        /**
         * Receive certificate — the certificate-code redeem posts BOTH halves as an
         * object: { cert: <public PEM>, key: <shared secret, '' when unset> }. It
         * used to post the bare PEM string, so guard on the shape rather than
         * truthiness: a legacy string body would otherwise reach setCertificate and
         * be stored as a certificate that can never import.
         *
         * This webhook is the ONLY delivery channel for `key` — it is deliberately
         * excluded from the CERTIFICATES:KEY:PULL snapshot, so if this is missed the
         * connector must redeem a fresh code rather than read it from a cache.
         */
        if (body['synch-data'] === 'r_cert' && isCertificateMaterial(body.result)) {
            await globalThis.__keenConnector.setCertificate(body.result.cert, body.result.key);
        }

        if (body['synch-data'] && Array.isArray(body['synch-data'])) {
            const instructions = body['synch-data'] as Array<string>;
            if (instructions.includes('r_api_keys')) {
                globalThis.__keenConnector?.reconnect();
            }

            if (instructions.includes('r_consumer_policy')) {
                globalThis.__keenConnector?.resources.getConsumerContract();
            }

            if (instructions.includes('r_consumer_policy_delete')) {
                globalThis.__keenConnector?.resources.removeConsumerContract();
            }

            if (instructions.includes('r_cert')) {
                globalThis.__keenConnector?.setActive(false);
                globalThis.__keenConnector?.fetchCertificateRetrier();
                globalThis.__keenConnector?.setActive(true);
            }

            if (instructions.includes('r_cert_delete')) {
                globalThis.__keenConnector?.setActive(false);
                globalThis.__keenConnector.setCertificate('');
            }
        }
    } catch (err) {
        console.log(`[keen] Error: ${(err as Error).message}`);
    }

    return NextResponse.json({ success: true });
}
