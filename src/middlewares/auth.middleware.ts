import { CONFIG, PROTECTED_ROUTES } from '@/global/config';
import { INTERNAL_API } from '@/server/api';
import { NextResponse } from 'next/server';

export async function middleware(props: App.MiddlewareProps) {
    const { pathname, collector, request } = props;
    const probe = pathname.replace(/^((?:\/[^\/]+){1}).*$/, '$1');

    const isApi = pathname.startsWith('/api/') && !pathname.includes('/login') && !pathname.includes('/registration');
    const isConfirm = pathname.includes('/confirmation/') || pathname.includes('/api/account/confirmation/');
    const isResetPassword = pathname.includes('/set-password/') || pathname.includes('/set_password');
    const isEvent = pathname.includes('/event');

    if (isConfirm || isResetPassword || isEvent) {
        return NextResponse.next();
    }

    if (isApi && pathname.includes('auth/get-or-refresh')) {
        return NextResponse.next({
            request: {}
        });
    }

    const validationResult = await INTERNAL_API.AUTH.GET_OR_REFRESH_AUTH();
    const isLogged = !!validationResult.success;

    collector.logged = String(!!validationResult.success);

    if (isApi || PROTECTED_ROUTES.includes(probe)) {
        if (isLogged) {
            /**
             * The user continue
             */
            return NextResponse.next({
                request: {}
            });
        }

        /**
         * In case of invalid token or missing token redirect the request to login page
         */
        return NextResponse.redirect(new URL(`${CONFIG.SERVER_ROUTES.LOGIN.url}`, request.url));
    }

    return false;
}
