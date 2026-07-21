/**
 * An RFC-4122 v4 UUID from `crypto.getRandomValues` — the Web Crypto global,
 * present in every supported browser and in Node >= 19.
 *
 * Deliberately NOT `crypto.randomUUID()`: that one is SECURE-CONTEXT-ONLY, so on
 * a plain-http origin (a LAN dev host, say) it is `undefined` and throws on the
 * first call. `getRandomValues` carries no such restriction and behaves the same
 * over http and https. The version (4) and variant (10xx) bits are set by hand to
 * make the random bytes a valid v4.
 *
 * Deliberately duplicated here rather than imported from the host app: this SDK
 * is self-contained (every import is relative) so it can be lifted out into its
 * own package as-is. Reaching into the consumer's `@/utils` would break that.
 */
export function generateUUID(): string {
    const bytes = new Uint8Array(16);

    crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));

    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}

/**
 * Generate a globally-unique request id of the form r-<uuid>. It MUST be
 * unique across browser tabs/sessions — not merely within one tab —
 * because the engine's ProcessCoordinator dedups in-flight work by
 * requestId ALONE (process-global, not per-connection). The old
 * `r-<base36 time>-<seq>` counter was per-tab only, so N tabs running in
 * lockstep minted identical ids; the engine then rejected the collision
 * as a spurious E2003 "Duplicate requestId", which the client treats as a
 * flow failure and cancels the whole cid, cascading into E6002 "flow
 * cancelled or stale" on every sibling clone. A v4 UUID is unique across
 * tabs. Minted once per SendRequest and reused across that request's
 * retries, so the engine's intended same-id retry dedup still holds.
 */
export function generateRequestId(): string {
    return `r-${generateUUID()}`;
}

/**
 * Read the browser's cookies as a flat { name: value } map. Forwarded on
 * the initial run so script nodes can read them via system/cookies. Note:
 * HttpOnly cookies are NOT visible to document.cookie and will not appear
 * here — only JS-readable cookies are forwarded.
 */
export function readBrowserCookies(): Record<string, string> {
    if (typeof document === 'undefined' || !document.cookie) {
        return {};
    }
    const out: Record<string, string> = {};
    for (const part of document.cookie.split(';')) {
        const idx = part.indexOf('=');
        if (idx === -1) {
            continue;
        }
        const name = part.slice(0, idx).trim();
        if (!name) {
            continue;
        }
        out[name] = decodeURIComponent(part.slice(idx + 1).trim());
    }
    return out;
}

/**
 * Promise-based sleep used by SendRequest's retry loop. Returns once
 * the given number of milliseconds has elapsed.
 */
export function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

/**
 * Format the current wall clock as HH:MM:SS.mmm. Shared between the
 * Connect class's system-emit messages and the UI log timestamps.
 */
export function timestamp(): string {
    const d = new Date();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    const s = String(d.getSeconds()).padStart(2, '0');
    const ms = String(d.getMilliseconds()).padStart(3, '0');

    return `${h}:${m}:${s}.${ms}`;
}
