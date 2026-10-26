import { NextRequest, NextResponse } from 'next/server';

import { GLOBAL_EVENT_KEY, getEventBus } from '@/service/events/event-bus';
import { isWebhookSecretValid } from '@/utils/webhook-secret';

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
 * POST /api/keen-webhook/<KEEN_WEBHOOK_SECRET>
 *
 * The api key's notification URL — Keen's org → site channel (certificate
 * delivery, WAKE, space/agent/contract changes, consumer force-logout).
 *
 * Keen does not sign these calls, so the URL carries a shared secret: register
 * `<KEEN_ORIGIN>/api/keen-webhook/<KEEN_WEBHOOK_SECRET>` as the Webhook's
 * notification URL in the Keen admin. A call without the right secret is refused
 * before its body is read. The proxy rate-limits this path.
 *
 * nodejs runtime so it sees the globalThis.__keenConnector singleton.
 */
export const runtime = 'nodejs';

export async function POST(req: NextRequest, { params }: { params: Promise<{ secret: string }> }) {
    const { secret } = await params;

    if (!isWebhookSecretValid(secret, process.env.KEEN_WEBHOOK_SECRET)) {
        return NextResponse.json({ success: false, status: 401, message: 'Unauthorized.' }, { status: 401 });
    }

    let body: Keen.Webhook.Payload | null = null;

    try {
        body = (await req.json()) as unknown as Keen.Webhook.Payload;

        // A route handler that returns nothing answers 500; say "not ready" instead.
        if (!globalThis.__keenConnector) {
            return NextResponse.json({ success: false, status: 503, message: 'Keen connection is not ready.' }, { status: 503 });
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
         *
         * acceptCertificate only takes it while a redeem the connector started is
         * outstanding, so even a leaked secret can't swap the key at an arbitrary time.
         */
        if (body['synch-data'] === 'r_cert' && isCertificateMaterial(body.result)) {
            await globalThis.__keenConnector.acceptCertificate(body.result.cert, body.result.key);
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

            // A contract change (spaces / defaults / policy / name-key) fires this.
            // Re-read BOTH halves: the contract (identity + master spaces) AND the
            // live policy (the registration/login booleans + default-space subsets,
            // which the contract endpoint only carries as mapped defaults).
            if (instructions.includes('r_consumer_policy')) {
                await Promise.allSettled([globalThis.__keenConnector?.resources.getConsumerContract(), globalThis.__keenConnector?.resources.getConsumerPolicy()]);
                // The cached space list is scoped to the contract's spaces — re-scope it.
                await globalThis.__keenConnector?.resources.getSpaceList();
            }

            if (instructions.includes('r_consumer_policy_delete')) {
                globalThis.__keenConnector?.resources.removeConsumerContract();
                globalThis.__keenConnector?.resources.removeConsumerPolicy();
            }

            // The current certificate keeps working until the new one is delivered.
            if (instructions.includes('r_cert')) {
                void globalThis.__keenConnector?.refreshCertificate();
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
