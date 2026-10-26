'use client';

import { createContext, useContext, useMemo } from 'react';

import { AUTH_API_CONFIG } from '@/configs/api.config';
import { demoChatApi } from '@/demo/demo-store';

/**
 * Client-side access to the signed-in consumer.
 *
 * The DATA is produced on the SERVER by `keen.tools.getConsumerData()` (httpOnly
 * cookies + the server-only keen cache) inside `(app)/layout.tsx`, then handed to
 * this provider as a serializable prop. Client components read it with
 * `useConsumer()` — no server call, no re-fetch.
 *
 * The CHAT METHODS are added here, on the client. They call this app's own
 * `/api/chat/*` route handlers, which perform the real two-token call to Keen —
 * the browser can't, because the application_token lives server-side on the
 * connector and the access token is an httpOnly cookie it cannot read.
 *
 * SECURITY: whatever is put in `value` is serialized into the client bundle. It
 * carries the access token (the chat WebSocket needs it) but never the refresh
 * token — `Keen.ConsumerData` has no field for it, so it can't be added by accident.
 */
const ConsumerContext = createContext<App.Consumer.ContextValue | null>(null);

/**
 * One fetch shape for every chat call. Always resolves to a Keen envelope — a
 * transport failure is folded into `{ success: false, status: 502 }` so callers
 * check `success` instead of wrapping each call in try/catch.
 */
async function callChatApi<T>(url: string, init?: RequestInit): Promise<Keen.ConsumerChatReply<T>> {
    try {
        const response = await fetch(url, init);
        return (await response.json()) as Keen.ConsumerChatReply<T>;
    } catch (err) {
        return { success: false, status: 502, message: (err as Error).message };
    }
}

function jsonPost(body: unknown): RequestInit {
    return {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    };
}

export function ConsumerProvider({ value, children }: { value: Keen.ConsumerData; children: React.ReactNode }) {
    // Built once — the methods close over nothing, so their identity is stable
    // and they're safe to use in a dependency array.
    const demo = value.demo === true;

    const chat = useMemo<App.Consumer.ChatApi>(
        () =>
            // Demo mode (utils/demo.ts): the same contract, served from memory.
            demo
                ? demoChatApi
                : {
                      list: () => callChatApi(AUTH_API_CONFIG.CHAT_LIST.URL),

                      history: (chatId, options) => {
                          const params = new URLSearchParams({ chatId });

                          if (options?.limit) {
                              params.set('limit', String(options.limit));
                          }

                          if (options?.before) {
                              params.set('before', options.before);
                          }

                          return callChatApi(`${AUTH_API_CONFIG.CHAT_HISTORY.URL}?${params.toString()}`);
                      },

                      search: (query, limit) => {
                          const params = new URLSearchParams({ q: query });

                          if (limit) {
                              params.set('limit', String(limit));
                          }

                          return callChatApi(`${AUTH_API_CONFIG.CHAT_SEARCH.URL}?${params.toString()}`);
                      },

                      setTitle: (chatId, title) => callChatApi(AUTH_API_CONFIG.CHAT_SET_TITLE.URL, jsonPost({ chatId, title })),

                      delete: chatId => callChatApi(AUTH_API_CONFIG.CHAT_DELETE.URL, jsonPost({ chatId }))
                  },
        [demo]
    );

    const context = useMemo<App.Consumer.ContextValue>(() => ({ ...value, chat }), [value, chat]);

    return <ConsumerContext.Provider value={context}>{children}</ConsumerContext.Provider>;
}

/**
 * Read the consumer snapshot + the chat methods. Throws if used outside a
 * <ConsumerProvider>, so a missing provider is a loud dev-time error rather than
 * a silent null.
 */
export function useConsumer(): App.Consumer.ContextValue {
    const ctx = useContext(ConsumerContext);

    if (ctx === null) {
        throw new Error('useConsumer must be used within a <ConsumerProvider>');
    }

    return ctx;
}
