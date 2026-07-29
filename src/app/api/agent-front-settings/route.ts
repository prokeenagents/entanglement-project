import { NextRequest, NextResponse } from 'next/server';

import { getKeen } from '@/service/services/keen/keen';
import { getAccessToken } from '@/utils/cookies';

/**
 * GET /api/agent-front-settings?agentId=<slug>
 *
 * The page-facing read of an agent's Front Settings. Cache-first: the connector
 * cache holds what the webhook receiver last fetched ('' = agent has none); a
 * MISS (agent never fetched) goes to the relay's tenancy-scoped resource
 * endpoint and self-primes the cache — from then on, the `r_agent_front_settings`
 * webhook keeps this agent fresh (the receiver re-fetches every cached slug).
 *
 * Session-gated like every consumer surface: the values are partner-side
 * configuration, not public content.
 *
 * Registered in AUTH_API_CONFIG — the proxy 404s any /api/* path not listed there.
 */
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    const accessToken = await getAccessToken();

    if (!accessToken) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const payload = await getKeen().tools.getTokenPayload(accessToken);

    if (!payload?.sub) {
        return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
    }

    const agentId = req.nextUrl.searchParams.get('agentId');

    if (!agentId) {
        return NextResponse.json({ success: false, message: 'Missing agentId' }, { status: 400 });
    }

    const connector = globalThis.__keenConnector;

    if (!connector) {
        return NextResponse.json({ success: false, message: 'Not connected' }, { status: 503 });
    }

    const cached = connector.cache.getAgentFrontSettings(agentId);

    if (cached !== null) {
        return NextResponse.json({ success: true, agentId, jsonSettings: cached });
    }

    const fetched = await connector.resources.getAgentFrontSettings(agentId);

    if (typeof fetched !== 'string') {
        /** false = refused (unknown agent / other tenant), null = transport error. */
        return NextResponse.json({ success: false, message: 'Not available' }, { status: fetched === false ? 404 : 503 });
    }

    return NextResponse.json({ success: true, agentId, jsonSettings: fetched });
}
