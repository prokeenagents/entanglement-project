import { CONFIG, OPEN_ROUTES } from '@/global/config';
import { INTERNAL_API } from '@/server/api';
import { NextResponse } from 'next/server';

export async function middleware(props: App.MiddlewareProps) {
    const { pathname, request } = props;

    if (OPEN_ROUTES.includes(pathname)) {
        if (/\/login\/?/.test(pathname)) {
            /**
             * This is the login page
             * Remove coockies if such
             */

            await INTERNAL_API.AUTH.LOGOUT();
        }

        /**
         * Validate access token
         */
        const validationResult = await INTERNAL_API.AUTH.GET_OR_REFRESH_AUTH();

        /**
         * If the token is still valid
         * Redirect the request to home page
         */
        if (validationResult.success) {
            return NextResponse.redirect(new URL(CONFIG.BASE_PATH, request.url));
        }

        /**
         * Else go to the requested route
         */
        return NextResponse.next();
    }

    return false;
}
