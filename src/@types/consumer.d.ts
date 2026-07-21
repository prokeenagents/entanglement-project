export {};

declare global {
    namespace App {
        namespace Consumer {
            /**
             * The consumer chat surface, as exposed to client components through
             * `useConsumer().chat`.
             *
             * Every method calls this app's OWN `/api/chat/*` route handlers, never
             * Keen directly: the upstream calls are two-token (an application_token
             * held server-side by the connector + the X-Access-Token httpOnly cookie
             * the browser cannot read), so the server has to make them.
             *
             * All of them resolve to the Keen envelope — check `success` rather than
             * catching. A transport failure surfaces as `{ success: false, status }`
             * too, so callers only ever handle one shape. The envelope is
             * discriminated by `success`, so narrowing gives you `data` fully typed:
             *
             *     const res = await chat.list();
             *     if (!res.success) return;
             *     res.data.items;          // Keen.ChatListItem[]
             */
            interface ChatApi {
                /** The consumer's active chats (archived excluded). */
                list: () => Promise<Keen.ConsumerChatListReply>;

                /**
                 * One chat's messages, newest first. `before` is the
                 * `<createdAt>:<id>` cursor round-tripped from the previous page's
                 * `data.nextCursor` (null on the last page).
                 */
                history: (chatId: string, options?: { limit?: number; before?: string }) => Promise<Keen.ConsumerChatHistoryReply>;

                /** Case-insensitive substring search over the consumer's chat titles. */
                search: (query: string, limit?: number) => Promise<Keen.ConsumerChatListReply>;

                /** Rename a chat. Owner-scoped upstream. */
                setTitle: (chatId: string, title: string) => Promise<Keen.ConsumerSetChatTitleReply>;

                /** Soft-delete (archive) a chat. Owner-scoped upstream. */
                delete: (chatId: string) => Promise<Keen.ConsumerDeleteChatReply>;
            }

            /**
             * What `useConsumer()` returns: the server-rendered snapshot
             * (`Keen.ConsumerData`) plus the client-side chat methods.
             */
            type ContextValue = Keen.ConsumerData & {
                chat: ChatApi;
            };
        }
    }
}
