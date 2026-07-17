import { NextResponse } from 'next/server';

/**
 * Short-circuit an API request from the proxy, using the SAME envelope shape the
 * route handlers return ({ success, status, message }) so the client hooks
 * classify a proxy refusal exactly like a handler refusal — no special-casing.
 *
 * Deliberately a RETURN, not a `throw`: an uncaught throw in the proxy is turned
 * by Next into a 500 HTML error page, which loses the real status (401 → 500) and
 * makes the hooks' JSON.parse fail, so every refusal would surface as
 * 'server-error'. A redirect is equally wrong on /api/* — the hook would parse the
 * login page's HTML as JSON (see the note in proxy-api.ts).
 */
export const apiError = (status: number, message: string) => NextResponse.json({ success: false, status, message }, { status });
