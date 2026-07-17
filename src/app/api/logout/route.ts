import { NextResponse } from 'next/server';

import { clearSessionCookies } from '@/utils/cookies';

/**
 * POST /api/logout
 *
 * Expires the httpOnly session cookies. The browser can't clear them itself
 * (httpOnly), so the client hook calls this and then redirects to /login.
 * Pinned to nodejs to match the rest of the auth surface.
 */
export const runtime = 'nodejs';

export async function POST() {
    const res = NextResponse.json({ success: true, status: 200, message: 'Logged out' });

    return clearSessionCookies(res);
}
