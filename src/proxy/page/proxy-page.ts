/**
 * This file is executed on every request
 * Back End !
 */
import { NextRequest, NextResponse } from 'next/server';

import { PAGE_CONFIG } from '@/configs/page.config';
import { proxyPageAuth } from './proxy-page-auth';
import { proxyPageGuest } from './proxy-page-guest';

export async function proxyPage(request: NextRequest, loginStatus: App.Session.State, pathname: string) {
    const authorized = loginStatus.authorized;

    if (authorized) {
        return proxyPageAuth(request, pathname);
    } else {
        return proxyPageGuest(request, pathname);
    }
}
