/**
 * This file is executed on every request
 * Back End !
 */
import { NextRequest, NextResponse } from 'next/server';
import { proxyApiAuth } from './proxy-api-auth';
import { proxyApiGuest } from './proxy-api-guest';

export async function proxyApi(request: NextRequest, loginStatus: App.Session.State, pathname: string) {
    const authorized = loginStatus.authorized;

    // Internal API routes reach their handlers directly — they return JSON (and
    // self-authorize), so they must NOT be caught by the page redirects below.
    // /api/login in particular has to be callable while logged out — that's the
    // whole point — otherwise the login POST gets 307'd to the /login HTML page
    // and the hook parses HTML as JSON.
    if (pathname.includes('/api/keen-webhook') || pathname.includes('/api/keen-callback') || pathname.includes('/api/logout')) {
        return NextResponse.next();
    }

    if (authorized) {
        return proxyApiAuth(request, pathname);
    } else {
        return proxyApiGuest(request, pathname);
    }
}
