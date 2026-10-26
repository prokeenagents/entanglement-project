export {};

declare global {
    namespace App {
        namespace ChatList {
            /** A chat list row resolved against the consumer's spaces + agents. */
            interface Entry {
                chat: Keen.ChatListItem;
                agent: Keen.SpaceListCacheAgent | null;
                space: Keen.SpaceListCacheResult | null;
                /** Where the row links to — null when the agent is no longer available. */
                href: string | null;
            }

            interface MutationResult {
                ok: boolean;
                message?: string;
            }

            /**
             * The consumer's conversations, shared by the sidebar, the home page and
             * the agent page so a rename / delete / new chat shows up everywhere at once.
             */
            interface ContextValue {
                entries: Entry[];
                loading: boolean;
                /** Re-read the list from the server (e.g. after a turn creates a chat). */
                refresh: () => Promise<void>;
                rename: (chatId: string, title: string) => Promise<MutationResult>;
                remove: (chatId: string) => Promise<MutationResult>;
            }
        }
    }
}
