'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

import { useAuth } from '@/contexts/auth';
import { useConsumer } from '@/contexts/consumer';
import ChatAPI from '@/service/services/chat';
import { generateUUID } from '@/utils/global';

type ChatShellValue = {
    /** The conversation-thread key — every turn and every history row is under it. */
    chatID: string;
    status: App.Chat.ConnectStatus;
    /** True from the instant runFlow() is called until it settles. */
    running: boolean;
    messages: App.ChatUI.Message[];
    /** Run one conversation turn. Resolves when the whole flow tree has drained. */
    send: (prompt: string) => Promise<void>;
    /** Stop the in-flight turn. No-op when nothing is running. */
    cancel: () => void;
};

const ChatShellContext = createContext<ChatShellValue | null>(null);

/**
 * Read the chat connection + conversation. Throws outside a <ChatShell>, so a
 * missing wrapper is a loud dev-time error rather than a silent null.
 */
export function useChat(): ChatShellValue {
    const ctx = useContext(ChatShellContext);

    if (ctx === null) {
        throw new Error('useChat must be used within a <ChatShell>');
    }

    return ctx;
}

/** Stream frames put the payload on `data.text`; anything else is JSON for display. */
const streamText = (data: App.Chat.InboundFrame['data']): string => {
    if (typeof data?.text === 'string') {
        return data.text;
    }

    return data?.data !== undefined ? JSON.stringify(data.data) : '';
};

/** How many live messages to keep in state. Older ones scroll off (FIFO). */
const MAX_MESSAGES = 50;

/**
 * The exact message TaskQueue.run() throws when a run is cancelled. A cancel is
 * user intent, not a failure — `send` matches on this to render a quiet row
 * instead of a red error bubble. Kept in sync with the SDK's throw site.
 */
const CANCELLED_MESSAGE = 'TaskQueue cancelled';

/**
 * How often a live chat rotates its access token. A chat session outlives the
 * token — the socket is bound to the cid, not the token, so a thread left open
 * would eventually start failing every send with E3002. Ticking well inside the
 * token's lifetime keeps a fresh one on the instance before that can happen.
 *
 * Cheap by design: when the current token still has life the relay answers with
 * its "still valid" fast-path and mints nothing, so most ticks cost one request
 * and change nothing.
 */
const TOKEN_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Append a message, keeping only the last MAX_MESSAGES — drop the oldest when the
 * 51st arrives. This is what bounds the streaming cost: setMessages' array copy
 * and the list's reconcile walk can never exceed MAX_MESSAGES, so a token in a
 * long session costs no more than a token in a short one, and memory stays flat.
 *
 * PUSH-only. The token-growth path replaces the streaming row in place (a `map`,
 * same length), so it never trips the cap — the currently-streaming bubble sits at
 * the tail and FIFO evicts from the front, so it can't be dropped mid-answer.
 */
const appendCapped = (prev: App.ChatUI.Message[], message: App.ChatUI.Message): App.ChatUI.Message[] => {
    const next = [...prev, message];

    return next.length > MAX_MESSAGES ? next.slice(next.length - MAX_MESSAGES) : next;
};

/**
 * ChatShell — owns the ChatAPI lifecycle and the conversation for one chat
 * thread, and hands both to the chat UI below via useChat().
 *
 * Why the instance lives in a ref + effect and not in the render body:
 * constructing a ChatAPI is cheap and side-effect-free (WSConnectAPI's
 * constructor only prepares the welcome promise — `.connect()` is what opens the
 * socket), but building it during render would mint a fresh client on every
 * re-render, and connect() cannot run during SSR anyway (no WebSocket on the
 * server). So: build + connect once on mount, tear down on unmount so route
 * changes and HMR don't leak sockets or pending waitFor promises.
 *
 * Identity comes from the SERVER — `consumerData` is read in the page via
 * getConsumerData(), because the connector and the httpOnly cookies exist only
 * there. The relay verifies the access token on EVERY frame, which is why the
 * token is synced onto the live instance below rather than merely captured at
 * construction.
 */
export const Component: React.FC<
    React.PropsWithChildren<{
        chatID: string;
        agentID: string;
        spaceID: string;
        consumerData: Keen.ConsumerData;
    }>
> = props => {
    const { consumerData, chatID, spaceID, agentID, children } = props;
    const consumer = useConsumer();
    const { checkAndRefreshToken } = useAuth();

    const email = consumerData.tokenPayload?.email;
    const userID = consumerData.tokenPayload?.sub;
    const accessToken = consumerData.accessToken;

    const selectedAgent = consumer.agents.find(a => a.active && a.id === agentID);
    const agentSlugID = selectedAgent?.agentId;

    const [status, setStatus] = useState<App.Chat.ConnectStatus>('disconnected');
    const [running, setRunning] = useState(false);
    const [messages, setMessages] = useState<App.ChatUI.Message[]>([]);

    const chatRef = useRef<ChatAPI | null>(null);
    /** The agent bubble currently being streamed into; reset at the start of each turn. */
    const agentMessageId = useRef<string | null>(null);

    /**
     * Mint + connect once per chat thread. Re-runs only when the thread or the
     * agent identity really changes — NOT on an accessToken change, which is
     * handled below without dropping the socket.
     */
    useEffect(() => {
        // No identity = nothing worth connecting with. The relay would refuse the
        // run anyway (E3101 for a bad agent, E3002 for a bad token), so don't open
        // a socket we already know can't carry one.
        if (!agentSlugID || !userID || !email || !accessToken) {
            return;
        }

        /**
         * The client can only be born here — not in render (that would mint one per
         * re-render, and connect() has no WebSocket during SSR).
         */
        const instance = new ChatAPI({
            spaceID,
            agentID: agentSlugID, // the SLUG — the cuid comes back as E3101
            userId: userID,
            email,
            accessToken,
            url: consumer.wsUrl
            // url defaults to CHAT_SETTINGS.WS_URL, projectID to spaceID — see chat/settings.ts
        });

        instance.onStatus(next => setStatus(next));

        instance.onRunning(next => {
            setRunning(next);

            // A new turn starts its own agent bubble.
            if (next) {
                agentMessageId.current = null;
            }
        });

        /**
         * The model's answer arrives HERE, not from runFlow() — that resolves to the
         * flow-tree snapshot, which is for inspection. `token` events are the output
         * and are accumulated into one bubble; the rest (thinking / processing /
         * progress) are surfaced as their own rows so a long run reads as progress
         * instead of a frozen screen.
         */
        instance.onStream((event, data) => {
            const text = streamText(data);

            if (!text) {
                return;
            }

            if (event === 'token') {
                const current = agentMessageId.current;

                if (current) {
                    setMessages(prev => prev.map(message => (message.id === current ? { ...message, text: message.text + text } : message)));
                    return;
                }

                const id = generateUUID();
                agentMessageId.current = id;
                setMessages(prev => appendCapped(prev, { id, role: 'agent', text }));

                return;
            }

            setMessages(prev => appendCapped(prev, { id: generateUUID(), role: event === 'error' ? 'error' : 'event', event, text }));
        });

        chatRef.current = instance;

        instance.connect();

        return () => {
            instance.disconnect();
            chatRef.current = null;
            setStatus('disconnected');
            setRunning(false);
        };
        // accessToken is deliberately NOT a dependency — see the sync effect below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatID, spaceID, agentSlugID, userID, email]);

    /**
     * Keep the live client's token current. The relay verifies it on EVERY frame,
     * so a refresh must take effect on the next send WITHOUT tearing the socket
     * down (the WS lifetime is bound to the cid, not the token). No-op before the
     * first connect.
     */
    useEffect(() => {
        if (accessToken) {
            chatRef.current?.setAccessToken(accessToken);
        }
    }, [accessToken]);

    /**
     * Keep the token alive for as long as this chat is open. The server prop above
     * only changes on a server re-render, which a long-lived chat thread never
     * triggers on its own — so without this the token would simply age out under a
     * connected socket.
     *
     * Ticks only when there IS a live client (no identity = no instance = nothing
     * to keep alive), and lands the result the same way the prop does: straight
     * onto the instance, no reconnect. A null means the session is genuinely over;
     * there is nothing useful to do with it here, so leave the stale token in place
     * and let the next send surface the failure — the logout event handler owns the
     * sign-out path.
     */
    useEffect(() => {
        const timer = setInterval(() => {
            if (!chatRef.current) {
                return;
            }

            void checkAndRefreshToken().then(token => {
                if (token) {
                    chatRef.current?.setAccessToken(token);
                }
            });
        }, TOKEN_REFRESH_INTERVAL_MS);

        return () => clearInterval(timer);
    }, [checkAndRefreshToken]);

    /**
     * One conversation turn. The same chatID is passed every time so the engine
     * groups every turn under one thread in chat_history.
     *
     * Never fires two runs at once: the SDK rejects a concurrent runFlow with
     * "TaskQueue already running", so the prompt UI gates on `running`. On failure
     * the SDK has ALREADY sent cancel and wiped the engine state for the cid by the
     * time we get here — there is nothing to clean up, only to report.
     */
    const send = useCallback(
        async (prompt: string) => {
            const instance = chatRef.current;
            const trimmed = prompt.trim();

            if (!instance || !trimmed) {
                return;
            }

            setMessages(prev => appendCapped(prev, { id: generateUUID(), role: 'user', text: trimmed }));

            try {
                await instance.runFlow({ chatId: chatID, prompt: trimmed });
            } catch (err) {
                const message = (err as Error).message;

                // A user cancel unwinds runFlow with CANCELLED_MESSAGE. That's intent,
                // not failure — surface it as a quiet event row, never a red error.
                if (message === CANCELLED_MESSAGE) {
                    setMessages(prev => appendCapped(prev, { id: generateUUID(), role: 'event', event: 'canceled', text: 'Canceled.' }));

                    return;
                }

                setMessages(prev => appendCapped(prev, { id: generateUUID(), role: 'error', text: message }));
            }
        },
        [chatID]
    );

    /**
     * Stop the current turn. chat.cancel() halts the drain loop, fires the relay
     * cancel frame (which wipes the engine's dict / session / agentState / queue
     * for this cid), and clears local bundle state; the pending runFlow then
     * rejects with CANCELLED_MESSAGE, handled in `send` above. Idempotent — safe
     * to call when nothing is running.
     */
    const cancel = useCallback(() => {
        chatRef.current?.cancel();
    }, []);

    return <ChatShellContext.Provider value={{ chatID, status, running, messages, send, cancel }}>{children}</ChatShellContext.Provider>;
};

Component.displayName = 'ChatShell';
