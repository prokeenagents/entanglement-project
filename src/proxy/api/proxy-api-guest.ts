/**
 * This file is executed on every request
 * Back End !
 */
import { NextRequest, NextResponse } from 'next/server';
import { GUEST_API_CONFIG } from '@/configs/api.config';
import { apiError } from './api-error';

export async function proxyApiGuest(request: NextRequest, pathname: string) {
    const URLs = Object.values(GUEST_API_CONFIG).map(({ URL }) => URL);

    // Logged out, so only the guest surface is reachable. 401 rather than 404: the
    // route probably DOES exist, they just can't have it without a session — and a
    // 404 here would tell an anonymous caller which routes exist and which don't.
    if (!URLs.includes(pathname)) {
        return apiError(404, 'Unknown API route.');
    }

    return NextResponse.next();
}
