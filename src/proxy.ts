/**
 * This file is executed on every request
 * Back End !
 */
import { NextRequest } from 'next/server';

import { checkLogin } from '@/utils/auth';
import { proxyApi } from './proxy/api/proxy-api';
import { proxyPage } from './proxy/page/proxy-page';

export async function proxy(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Evaluate the session from the httpOnly cookies (utils/auth). Gate page access
    // on `authorized` (a valid access token). authorized already implies
    // authenticated. TODO(refresh): when authenticated && !authorized, silently
    // refresh the access token instead of bouncing to /login.
    const loginStatus = await checkLogin(request);

    if (pathname.startsWith('/api/')) {
        return proxyApi(request, loginStatus, pathname);
    } else {
        return proxyPage(request, loginStatus, pathname);
    }
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|.*\\.png$).*)', '/']
};
