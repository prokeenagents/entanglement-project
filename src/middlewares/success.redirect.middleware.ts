import { NextResponse } from 'next/server';

export async function middleware(props: App.MiddlewareProps) {
    const { request, pathname, searchParams } = props;

    const isExactPage = /\/success-redirect$/.test(pathname);

    if (!isExactPage) {
        return false;
    }

    const code = searchParams.get('code');

    if (!code) {
        const response = NextResponse.redirect(new URL('/', request.url));
        return response;
    }

    if (String(code) === '3000') {
        const response = NextResponse.redirect(new URL('/thank-you', request.url));
        response.cookies.set('x-code', code, { httpOnly: true, sameSite: 'lax', secure: true, path: '/' });
        return response;
    }

    const response = NextResponse.redirect(new URL('/', request.url));
    return response;
}
