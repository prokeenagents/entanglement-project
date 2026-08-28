import { NextRequest, NextResponse } from 'next/server';

import { GLOBAL_EVENT_KEY, getEventBus } from '@/service/events/event-bus';

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

            // Org-wide config changed: a space was mutated, or one of its agents was.
            // Re-read the list into the connector cache FIRST, then tell every open
            // browser — publishing before the fetch settles would have them re-render
            // off the stale cache and miss the very change we're announcing.
            //
            // Broadcast, not targeted: spaces + agents are the same for everyone, and
            // the event carries no payload — just "re-read them".
            if (instructions.includes('r_space') || instructions.includes('r_agent')) {
                await globalThis.__keenConnector?.resources.getSpaceList();

                getEventBus().publish(GLOBAL_EVENT_KEY, {
                    type: 'space-change',
                    resource: instructions.includes('r_agent') ? 'agent' : 'space',
                    at: Date.now()
                });
            }

            // An agent's partner-facing Front Settings changed. Notify-then-fetch:
            // re-read the settings for every agent this site has actually used (the
            // connector cache keys) BEFORE announcing, so handlers and pages read the
            // fresh values, not the stale cache. The webhook body carries no agent id
            // by convention — the fetch leg is the source of truth. Two triggers land
            // here: `r_agent_front_settings` (an admin saved the front settings) and
            // `r_json` (an api-key WAKE, which re-pushes the front JSON among its caches).
            if (instructions.includes('r_agent_front_settings') || instructions.includes('r_json')) {
                const agentIds = globalThis.__keenConnector?.cache.getAgentFrontSettingsKeys() ?? [];
                await Promise.allSettled(agentIds.map(agentId => globalThis.__keenConnector?.resources.getAgentFrontSettings(agentId)));

                getEventBus().publish(GLOBAL_EVENT_KEY, {
                    type: 'agent-front-settings-change',
                    at: Date.now()
                });
            }

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

            // Consumer-targeted pushes — all three re-auth the consumer via a fresh
            // login: account removed, contract changed, or spaces changed (the last
            // because entitlements live in the token, so only a re-mint reflects them).
            // The bus routes to that consumer's browser by id, and the event ALSO
            // carries the id, so the handler acts only for the matching user.
            const consumerId = body.consumer?.id;
            if (consumerId) {
                const reason = instructions.includes('r_consumer_logout')
                    ? 'account removed'
                    : instructions.includes('r_consumer_contract_changed')
                      ? 'contract changed'
                      : instructions.includes('r_consumer_spaces_update')
                        ? 'spaces updated'
                        : null;

                if (reason) {
                    getEventBus().publish(consumerId, { type: 'logout', consumerId, reason, at: Date.now() });
                }
            }
        }
    } catch (err) {
        console.log(`[keen] Error: ${(err as Error).message}`);
    }

    return NextResponse.json({ success: true });
}
