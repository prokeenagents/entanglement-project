/**
 * This file is executed on every request
 * Back End !
 */
import { NextRequest, NextResponse } from 'next/server';
import { API_CONFIG } from '@/configs/api.config';
import { apiError } from './api-error';

export async function proxyApiAuth(request: NextRequest, pathname: string) {
    const URLs = Object.values(API_CONFIG).map(({ URL }) => URL);

    // Reachable because Next 16's Proxy runs on the Node.js runtime and shares
    // globalThis with instrumentation.ts — the singleton really is visible here
    // (under the old edge Middleware it never would have been). Every route past
    // this point drives the connector, so refuse once here instead of letting each
    // handler rediscover it. /api/logout is exempt by virtue of being short-
    // circuited upstream in proxy-api.ts: signing out must work while Keen is down.
    if (!globalThis.__keenConnector?.isReady) {
        return apiError(503, 'Keen connection is not ready.');
    }

    // Allow-list the known API surface. API_CONFIG spreads GUEST_API_CONFIG, so a
    // signed-in caller keeps the guest routes too; auth-only routes get added to
    // API_CONFIG and are then reachable here but not in proxy-api-guest.
    if (!URLs.includes(pathname)) {
        return apiError(404, 'Unknown API route.');
    }

    return NextResponse.next();
}
