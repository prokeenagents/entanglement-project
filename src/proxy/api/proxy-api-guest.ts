/**
 * This file is executed on every request
 * Back End !
 */
import { NextRequest, NextResponse } from 'next/server';
import { AUTH_API_CONFIG, GUEST_API_CONFIG } from '@/configs/api.config';
import { apiError } from './api-error';

export async function proxyApiGuest(request: NextRequest, pathname: string) {
    const guestURLs = Object.values(GUEST_API_CONFIG).map(({ URL }) => URL);
    const authURLs = Object.values(AUTH_API_CONFIG).map(({ URL }) => URL);

    if (guestURLs.includes(pathname)) {
        return NextResponse.next();
    }

    // A signed-in route without a valid session — usually an expired one. 401, so
    // callers (the events long-poll, the chat calls) know to stop and re-authenticate
    // instead of treating it as a missing route and retrying forever.
    if (authURLs.includes(pathname)) {
        return apiError(401, 'Session expired. Please sign in again.');
    }

    return apiError(404, 'Unknown API route.');
}
