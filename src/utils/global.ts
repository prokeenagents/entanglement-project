/**
 * Small isomorphic helpers — safe to import from a client component OR the
 * server. Nothing in here touches `node:crypto`, which would break the client
 * bundle.
 */

/**
 * An RFC-4122 v4 UUID from `crypto.getRandomValues` — the Web Crypto global,
 * present in every supported browser and in Node ≥ 19.
 *
 * Deliberately NOT `crypto.randomUUID()`: that one is secure-context-only, so on
 * a plain-http origin (this app in dev, `http://192.168.68.120:3000`) it is
 * `undefined` and would throw. `getRandomValues` carries no such restriction, so
 * it works over http and https alike — one path, no branching. We set the
 * version (4) and variant (10xx) bits by hand to make the random bytes a valid v4.
 *
 * No `Math.random()` fallback on purpose: it isn't a CSPRNG, and these ids also
 * become the SDK's requestId / sessionId — where a collision surfaces as
 * `E2003 Duplicate requestId` and cascades into E6002 across sibling flows.
 */
export const generateUUID = (): string => {
    const bytes = new Uint8Array(16);

    crypto.getRandomValues(bytes);

    bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
    bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10xx

    const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));

    return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
};
