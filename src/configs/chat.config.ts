export const CHAT_CONFIG = {
    /**
     * The ms-relay WebSocket endpoint the chat SDK connects to.
     *
     * Resolved in the BROWSER, so it must name a host the END USER's machine can
     * reach. Keep it on the same host the app is served from — `KEEN_CONFIG.ORIGIN`
     * is `http://192.168.68.120:3000`, so this is `192.168.68.120`. Change one,
     * change the other.
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
     * Verified: an upgrade to this URL carrying `Origin: http://192.168.68.120:3000`
     * returns `101 Switching Protocols`.
     */
    WS_URL: 'ws://192.168.68.120:5520/ws'
};
