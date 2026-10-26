'use client';

import { DEMO_CHATS, DEMO_HISTORY } from './fixtures';

/**
 * Demo mode's in-memory stand-in for the Keen chat backend (utils/demo.ts).
 *
 * Module-level state, seeded from the fixtures: it survives client navigations and
 * resets on a full reload — enough to exercise create / rename / delete / search
 * and history end to end. `demoChatApi` implements the exact App.Consumer.ChatApi
 * contract, so the UI code has no demo branches beyond picking which one to use.
 */

let chats: Keen.ChatListItem[] = DEMO_CHATS.map(chat => ({ ...chat }));
let history: Record<string, Keen.ChatHistoryItem[]> = Object.fromEntries(Object.entries(DEMO_HISTORY).map(([id, items]) => [id, items.map(item => ({ ...item }))]));

const byUpdated = (a: Keen.ChatListItem, b: Keen.ChatListItem) => b.updatedAt.localeCompare(a.updatedAt);

const later = <T>(value: T, ms = 180): Promise<T> => new Promise(resolve => setTimeout(() => resolve(value), ms));

const ok = <T>(data: T) => ({ success: true as const, status: 200, message: 'OK', data });

/** Record a finished (or cancelled / failed) turn — what the engine persists. */
export function recordDemoTurn(chatId: string, agentId: string, prompt: string, response: string, responseType: Keen.ChatHistoryItem['responseType']) {
    const now = new Date().toISOString();
    const item: Keen.ChatHistoryItem = { id: `demo-${Date.now()}`, prompt, response, responseType, agentId, createdAt: now };

    history = { ...history, [chatId]: [item, ...(history[chatId] ?? [])] };

    const existing = chats.find(chat => chat.chatId === chatId);
    const title = existing?.title ?? (prompt.length > 48 ? `${prompt.slice(0, 47).trimEnd()}…` : prompt);

    chats = existing ? chats.map(chat => (chat.chatId === chatId ? { ...chat, title, updatedAt: now } : chat)) : [{ chatId, title, agentId, createdAt: now, updatedAt: now }, ...chats];
}

export const demoChatApi: App.Consumer.ChatApi = {
    list: () => later(ok({ items: [...chats].sort(byUpdated) })),

    history: (chatId, options) => {
        const items = (history[chatId] ?? []).slice(0, options?.limit ?? 50);

        return later(ok({ items, nextCursor: null }), 260);
    },

    search: (query, limit) => {
        const needle = query.trim().toLowerCase();
        const items = chats.filter(chat => (chat.title ?? '').toLowerCase().includes(needle)).slice(0, limit ?? 20);

        return later(ok({ items }));
    },

    setTitle: (chatId, title) => {
        chats = chats.map(chat => (chat.chatId === chatId ? { ...chat, title } : chat));

        return later(ok({ chatId, title }));
    },

    delete: chatId => {
        chats = chats.filter(chat => chat.chatId !== chatId);

        return later(ok({ chatId, archived: true }));
    }
} as App.Consumer.ChatApi;
