/**
 * DEMO MODE — run the UI with fixture data and a simulated agent, no Keen needed.
 *
 *     ENTANGLEMENT_DEMO=1 npm run dev
 *
 * Server-only flag (no NEXT_PUBLIC_), and hard-disabled in production builds so it
 * can never bypass auth on a deployed site. When on:
 *   - the proxy treats every visitor as signed in and the connector as ready,
 *   - getConsumerData() returns the fixture consumer (src/demo/fixtures.ts),
 *   - the client swaps the chat API + WebSocket for in-memory fakes (src/demo/*).
 *
 * It exists for designers and front-end work: every screen, empty state and chat
 * state (thinking, tool calls, streaming, errors) can be exercised offline.
 */
export function isDemoMode(): boolean {
    return process.env.ENTANGLEMENT_DEMO === '1' && process.env.NODE_ENV !== 'production';
}

/** How long the proxy holds a request while the connector finishes its boot. */
export const APP_READY_WAIT_MS = 10_000;

const APP_READY_POLL_MS = 100;

/** The connector is usable and its boot reads are done — or demo mode stands in for it. */
export function isAppReady(): boolean {
    const connector = globalThis.__keenConnector;

    return isDemoMode() || Boolean(connector?.isReady && connector.isActivated);
}

/**
 * Cold start: hold the request up to `timeoutMs` while the connector is still in its
 * boot handshake (token → certificate → first reads), instead of bouncing the first
 * visitor to the maintenance page. On Cloud Run the held request is also what keeps
 * the instance's CPU allocated, so the handshake progresses while we wait.
 *
 * Returns at once when there is nothing to wait for: no connector (missing config), or
 * a connector that finished booting yet is not ready (contract removed) — that state
 * does not clear by itself.
 */
export async function waitForAppReady(timeoutMs: number = APP_READY_WAIT_MS): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;

    while (!isAppReady()) {
        const connector = globalThis.__keenConnector;

        if (!connector || connector.isActivated || Date.now() >= deadline) {
            return false;
        }

        await new Promise(resolve => setTimeout(resolve, APP_READY_POLL_MS));
    }

    return true;
}
