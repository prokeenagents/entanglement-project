'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';

import { useConsumer } from '@/contexts/consumer';
import { chatHref } from '@/utils/routes';

/**
 * The consumer's conversation list — one copy for the whole authenticated tree.
 *
 * Seeded from the server (`(app)/layout.tsx` reads the list where the two-token
 * call can be made) and kept fresh on the client: rename / delete update the list
 * once the server confirms, and `refresh()` re-reads after a turn so a brand-new chat appears in the sidebar
 * the moment its first answer lands.
 *
 * Rows are resolved against the consumer's spaces here, once, so every consumer
 * gets the agent, the space and the link without re-deriving them.
 */
const ChatListContext = createContext<App.ChatList.ContextValue | null>(null);

const byUpdated = (a: Keen.ChatListItem, b: Keen.ChatListItem) => b.updatedAt.localeCompare(a.updatedAt);

export function ChatListProvider({ initial, children }: { initial: Keen.ChatListItem[]; children: React.ReactNode }) {
    const consumer = useConsumer();
    const [chats, setChats] = useState<Keen.ChatListItem[]>(initial);
    const [loading, setLoading] = useState(false);

    /**
     * Bumped by every refresh AND every local mutation. A list() response is only
     * applied if nothing newer happened while it was in flight — otherwise a slow
     * refresh could resurrect a chat deleted (or revert one renamed) meanwhile.
     */
    const version = useRef(0);

    const refresh = useCallback(async () => {
        const mine = ++version.current;
        setLoading(true);

        try {
            const reply = await consumer.chat.list();

            if (reply.success && mine === version.current) {
                setChats(reply.data.items);
            }
        } finally {
            setLoading(false);
        }
    }, [consumer.chat]);

    const rename = useCallback(
        async (chatId: string, rawTitle: string): Promise<App.ChatList.MutationResult> => {
            const title = rawTitle.trim();

            if (!title) {
                return { ok: false, message: 'A title cannot be empty.' };
            }

            const reply = await consumer.chat.setTitle(chatId, title);

            if (!reply.success) {
                return { ok: false, message: reply.message ?? 'Could not rename the chat.' };
            }

            version.current++;
            setChats(prev => prev.map(chat => (chat.chatId === chatId ? { ...chat, title } : chat)));

            return { ok: true };
        },
        [consumer.chat]
    );

    const remove = useCallback(
        async (chatId: string): Promise<App.ChatList.MutationResult> => {
            const reply = await consumer.chat.delete(chatId);

            if (!reply.success) {
                return { ok: false, message: reply.message ?? 'Could not delete the chat.' };
            }

            version.current++;
            setChats(prev => prev.filter(chat => chat.chatId !== chatId));

            return { ok: true };
        },
        [consumer.chat]
    );

    const entries = useMemo<App.ChatList.Entry[]>(() => {
        const spaces = consumer.consumerSpaces;

        return [...chats].sort(byUpdated).map(chat => {
            // The list carries the agent SLUG; accept the row id too, defensively.
            const agent = consumer.agents.find(a => a.agentId === chat.agentId || a.id === chat.agentId) ?? null;
            const space = agent ? (spaces.find(s => s.id === agent.spaceId) ?? null) : null;
            const href = agent && space && agent.active ? chatHref(space.id, agent.id, chat.chatId) : null;

            return { chat, agent, space, href };
        });
    }, [chats, consumer.agents, consumer.consumerSpaces]);

    const value = useMemo<App.ChatList.ContextValue>(() => ({ entries, loading, refresh, rename, remove }), [entries, loading, refresh, rename, remove]);

    return <ChatListContext.Provider value={value}>{children}</ChatListContext.Provider>;
}

export function useChatList(): App.ChatList.ContextValue {
    const ctx = useContext(ChatListContext);

    if (ctx === null) {
        throw new Error('useChatList must be used within a <ChatListProvider>');
    }

    return ctx;
}
