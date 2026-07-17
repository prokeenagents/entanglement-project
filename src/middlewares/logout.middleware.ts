import { INTERNAL_API } from '@/server/api';
import { NextResponse } from 'next/server';

export async function middleware(props: App.MiddlewareProps) {
    const { request, pathname } = props;

    const isExactPage = /\/logout$/.test(pathname);

    if (!isExactPage) {
        return false;
    }

    await INTERNAL_API.AUTH.LOGOUT();

    const redirectResponse = NextResponse.redirect(new URL('/login', request.url));
    return redirectResponse;
}
