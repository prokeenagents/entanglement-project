import { NextResponse } from 'next/server';

export async function middleware(props: App.MiddlewareProps) {
    const { request, pathname } = props;
    const headers = new Headers(request.headers);

    const isExactPage = /\/error$/.test(pathname);

    if (!isExactPage) {
        return false;
    }

    const errorCode = request.cookies.get('x-error-code')?.value;

    if (errorCode) {
        headers.set('x-error-code', String(errorCode));
    }

    const response = NextResponse.next({
        request: {
            headers
        }
    });

    /**
     * Delete the cookie from the response
     * It serves only to transfer redirect data - ONCE
     */
    response.cookies.delete('x-error-code');
    return response;
}
