/**
 * This file is executed on every request
 * Back End !
 */
import { PAGE_CONFIG, GUEST_PAGE_CONFIG } from '@/configs/page.config';
import { NextRequest, NextResponse } from 'next/server';
import { isAppReady, waitForAppReady } from '@/utils/demo';

export async function proxyPageGuest(request: NextRequest, pathname: string) {
    // A cold start holds the request until the connector has booted (utils/demo.ts);
    // the maintenance page itself is answered at once.
    const ready = pathname === PAGE_CONFIG.MAINTENANCE.URL ? isAppReady() : await waitForAppReady();

    if (!ready) {
        if (pathname === PAGE_CONFIG.MAINTENANCE.URL) {
            return NextResponse.next();
        }

        return NextResponse.redirect(new URL(`${PAGE_CONFIG.MAINTENANCE.URL}`, request.url));
    }

    if (ready) {
        if (pathname === PAGE_CONFIG.MAINTENANCE.URL) {
            return NextResponse.redirect(new URL(`/`, request.url));
        }
    }

    /**
     * Priority depends from according to the order
     * =============================================
     */

    const PAGE_VALUES = Object.values(GUEST_PAGE_CONFIG).map(({ URL }) => URL);

    if (!PAGE_VALUES.includes(pathname)) {
        // The email-link landing pages carry a /<hash> segment, so they never match
        // exactly — allow them by prefix: /set-password/<hash> and /confirmation/<hash>.
        if (pathname.includes(`${GUEST_PAGE_CONFIG.SET_PASSWORD.URL}/`) || pathname.includes(`${GUEST_PAGE_CONFIG.CONFIRMATION.URL}/`)) {
            return NextResponse.next();
        }

        return NextResponse.redirect(new URL(`${GUEST_PAGE_CONFIG.LOGIN.URL}`, request.url));
    }

    return NextResponse.next();
}
