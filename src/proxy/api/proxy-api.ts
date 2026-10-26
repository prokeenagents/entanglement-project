/**
 * This file is executed on every request
 * Back End !
 */
import { NextRequest, NextResponse } from 'next/server';
import { proxyApiAuth } from './proxy-api-auth';
import { proxyApiGuest } from './proxy-api-guest';
import { guardApiRequest, isKeenInbound } from './request-guard';

export async function proxyApi(request: NextRequest, loginStatus: App.Session.State, pathname: string) {
    // Cross-site (CSRF) and rate-limit refusals come first, for every API route.
    const refusal = guardApiRequest(request, pathname);

    if (refusal) {
        return refusal;
    }

    const authorized = loginStatus.authorized;

    // Keen's inbound calls and logout reach their handlers directly — they return
    // JSON (and self-authorize: the webhook checks its URL secret), so they must NOT
    // be caught by the session gates below. Signing out must also work while Keen
    // is down.
    if (isKeenInbound(pathname) || pathname === '/api/logout') {
        return NextResponse.next();
    }

    if (authorized) {
        return proxyApiAuth(request, pathname);
    } else {
        return proxyApiGuest(request, pathname);
    }
}
