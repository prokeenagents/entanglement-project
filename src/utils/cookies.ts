import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';

const WEEK_SECONDS = 60 * 60 * 24 * 7;

/**
 * Write the consumer session tokens as httpOnly cookies on `res`. Browser JS
 * never reads these (httpOnly) — server-side routes read them and forward the
 * access token as X-Access-Token on two-token consumer calls. `secure` is on
 * only in production, since dev runs over plain HTTP (a secure cookie would be
 * silently dropped).
 */
export function setSessionCookies(res: NextResponse, tokens: App.Session.Tokens): NextResponse {
    const secure = process.env.NODE_ENV === 'production';

    res.cookies.set(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
        httpOnly: true,
        secure,
        sameSite: 'lax',
        path: '/',
        maxAge: tokens.expiresIn ?? WEEK_SECONDS
    });

    if (tokens.refreshToken) {
        res.cookies.set(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
            httpOnly: true,
            secure,
            sameSite: 'lax',
            path: '/',
            maxAge: WEEK_SECONDS * 4
        });
    }

    return res;
}

/**
 * Read the access token from the request cookies. Server-only (httpOnly cookie),
 * so callable from Server Components, Route Handlers, or Server Actions — never
 * client JS. Returns `undefined` when there is no session.
 */
export async function getAccessToken(): Promise<string | undefined> {
    const store = await cookies();
    return store.get(ACCESS_TOKEN_COOKIE)?.value;
}

/**
 * Read the refresh token from the request cookies. Same server-only rules as
 * getAccessToken.
 */
export async function getRefreshToken(): Promise<string | undefined> {
    const store = await cookies();
    return store.get(REFRESH_TOKEN_COOKIE)?.value;
}

/**
 * Expire the session cookies (logout). Sets them empty with maxAge 0 using the
 * same path/attrs they were written with, so the browser drops them.
 */
export function clearSessionCookies(res: NextResponse): NextResponse {
    const secure = process.env.NODE_ENV === 'production';

    for (const name of [ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE]) {
        res.cookies.set(name, '', {
            httpOnly: true,
            secure,
            sameSite: 'lax',
            path: '/',
            maxAge: 0
        });
    }

    return res;
}
