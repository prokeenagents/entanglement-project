import ChatAPI from './index';

/**
 * KeenChat — the MINIMAL Keen chat connector.
 *
 * Everything you need to connect a consumer to an agent and chat, and nothing
 * else. It does NO partner-integration work — no certificate, no WAKE, no
 * application token, no resource mirroring, no webhook. Those belong to the
 * server-to-server partner surface and are NOT needed to run a chat, so this
 * connector never reaches for them and can't fail on a missing cert / client
 * secret. At construction it makes zero network calls; it only opens a
 * WebSocket to the relay (on connect()) and runs flows authed by the consumer
 * token (the relay verifies it on every frame).
 *
 * The connector code is a constant — only the five config values change per
 * deployment.
 *
 *   const chat = new KeenChat({ ws, token, email });
 *   chat.onStream((event, data) => render(event, data));   // the answer arrives here
 *   chat.connect();
 *   await chat.run({ agentId, spaceId, chatId, prompt });
 */
export interface KeenChatConfig {
    /** Relay WebSocket endpoint — e.g. `wss://<sandbox-host>/ws-keen`. */
    ws: string;
    /** Consumer access token. The relay verifies it on EVERY frame. */
    token: string;
    /** Consumer email — carried in the run's userContext (identity). */
    email: string;
    /**
     * Consumer id. Defaults to the token's `sub` claim (decoded, unverified) —
     * which is exactly what the relay checks `userContext.userId` against, so
     * the default always matches. Pass it only to override.
     */
    userId?: string;
    /**
     * Keen edge base URL — e.g. `https://<sandbox-host>`. Kept for a token
     * refresh YOU drive (`POST /v1/auth/refresh` → setToken()); the connector
     * never calls it on its own.
     */
    host?: string;
    /**
     * This page's origin — must be allow-listed on the api_key or the relay's
     * OriginGuard drops the socket. In a browser the WS `Origin` header IS the
     * page origin automatically, so this is informational (document / assert);
     * the connector does not send it.
     */
    origin?: string;
}

/** One turn: which agent, which space, which chat thread, and the prompt. */
export interface KeenChatRun {
    /** The agent SLUG (`agent.agentId`) — never the row cuid (→ E3101). */
    agentId: string;
    /** The space id (=== projectId). */
    spaceId: string;
    /** The chat thread id — REQUIRED; every chat_history row is keyed by it. */
    chatId: string;
    /** The user's message. */
    prompt: string;
}

/**
 * Read the `sub` claim off a JWT WITHOUT verifying it — the relay verifies the
 * signature; we only need the id to fill userContext, and it must equal `sub`.
 * Returns '' on any malformed token (the caller can pass an explicit userId).
 */
function subFromToken(token: string): string {
    try {
        const seg = token.split('.')[1];
        if (!seg) return '';
        const json = atob(seg.replace(/-/g, '+').replace(/_/g, '/'));
        const claims = JSON.parse(json) as { sub?: unknown };
        return typeof claims.sub === 'string' ? claims.sub : '';
    } catch {
        return '';
    }
}

export default class KeenChat {
    /** The underlying ChatAPI — reach in only for advanced composition. */
    readonly api: ChatAPI;

    constructor(config: KeenChatConfig) {
        this.api = new ChatAPI({
            url: config.ws,
            accessToken: config.token,
            email: config.email,
            userId: config.userId ?? subFromToken(config.token),
            // Per-run values — every run() supplies its own, so the presets are blank.
            spaceID: '',
            agentID: '',
        });
    }

    /** Open the WebSocket. No-op if already open. */
    connect(): void {
        this.api.connect();
    }

    /** Close the WebSocket. */
    disconnect(): void {
        this.api.disconnect();
    }

    /**
     * Apply a refreshed access token mid-session — no reconnect. The WS carries
     * no auth, so the new token simply rides the next frame's userContext.
     */
    setToken(token: string): void {
        this.api.setAccessToken(token);
    }

    /** Live agent token stream — where the answer actually arrives. */
    onStream(handler: App.Chat.StreamEventHandler): App.Chat.Unsubscribe {
        return this.api.onStream(handler);
    }

    /** Connection status changes (connecting / open / closed). */
    onStatus(handler: App.Chat.StatusHandler): App.Chat.Unsubscribe {
        return this.api.onStatus(handler);
    }

    /** Orchestrator `<SYSTEM CALL>` directives, as plain text. */
    onSystem(handler: App.Chat.SystemHandler): App.Chat.Unsubscribe {
        return this.api.onSystem(handler);
    }

    /**
     * Run one turn to completion — sends the prompt, drives every node
     * (sequential / parallel / tool sub-flows), resolves with the final
     * flow-tree bundle. Throws on a node error or cancellation.
     */
    run(input: KeenChatRun): Promise<ReadonlyMap<string, App.Chat.FlowTaskBundle>> {
        return this.api.runFlow({
            chatId: input.chatId,
            prompt: input.prompt,
            agentId: input.agentId,
            projectId: input.spaceId,
        });
    }

    /** Cancel the in-flight run (wipes the engine's state for it). */
    cancel(): boolean {
        return this.api.sendCancel();
    }
}
