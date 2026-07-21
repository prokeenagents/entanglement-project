/**
 * CHAT_SETTINGS — every tunable constant the chat SDK uses, in one place.
 *
 * These are the DEFAULTS the SDK falls back to when a caller doesn't specify a
 * value. They live inside the SDK (not in the app's `configs/`) so it stays
 * self-contained — a `new ChatAPI({ ... })` needs to pass only what differs from
 * these. Override per-deployment through `ChatAPIOptions` rather than editing the
 * numbers here.
 */
export const CHAT_SETTINGS = {
    /**
     * Default ms-relay WebSocket endpoint. Override per-deployment via
     * `ChatAPIOptions.url`.
     *
     * Resolved in the BROWSER, so it must name a host the END USER's machine can
     * reach. Keep it on the same host the app is served from — if the app's origin
     * is `http://192.168.68.120:3000`, this is `192.168.68.120`. Change one, change
     * the other.
     *
     * NOT `localhost`: in a browser that means the machine running the BROWSER, not
     * the machine running the relay. It appears to work while you develop on the
     * same box as the stack, then fails the moment the app is opened from a phone
     * or a second laptop — where `localhost:5520` is simply nothing. The relay
     * binds 0.0.0.0:5520, so the LAN address works from anywhere on the network.
     *
     * `ws://` not `wss://` on purpose for dev: the page is plain http, and a wss://
     * endpoint behind the stack's self-signed cert fails as a SILENT close-1006
     * until you've visited https://localhost and accepted the cert. An https
     * deployment MUST flip to `wss://` — browsers block ws:// from an https page as
     * mixed content. Behind nginx the public path is `/ws-keen`
     * (`wss://<host>/ws-keen`) rather than `:5520/ws`.
     *
     * The browser's Origin must be allow-listed on the api_key, or OriginGuard
     * destroys the upgrade socket and the WS closes 1006 with no explanation.
     */
    WS_URL: 'ws://192.168.68.120:5520/ws',

    /**
     * How long ResponseAPI.waitFor() waits for a matching response envelope before
     * rejecting. 10min so a debug pause never trips the per-node retry; drop to
     * 30_000 for normal load testing.
     */
    RESPONSE_TIMEOUT_MS: 600_000,

    /**
     * Backoff between retries — both SendRequest's transport retries (socket not
     * ready) and TaskQueue's per-node response retries (transient engine error).
     */
    RETRY_DELAY_MS: 1_000,

    /**
     * Heartbeat cadence while a run is in flight. Fires a 'ping' that refreshes the
     * engine's dict/session TTL (60s) → 12x margin, so a live flow survives a brief
     * drop while abandoned state still reclaims within ~a minute.
     */
    HEARTBEAT_INTERVAL_MS: 5_000,

    /**
     * parallelContext fan-out drain batch — at most this many clones in flight at
     * once, so a huge collection never floods the engine. Kept below the engine's
     * 33 admission slots so a single fan-out won't self-reject.
     */
    CONTEXT_BATCH_SIZE: 15,

    /**
     * Bounded retry count for INITIAL-run frames (a failed start means the user's
     * request never began). Continuations retry infinitely instead — the flow is
     * already alive server-side, so we keep trying until the socket recovers.
     */
    INITIAL_MAX_RETRIES: 10
} as const;
