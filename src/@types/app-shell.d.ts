export {};

declare global {
    namespace App {
        namespace AppShell {
            /** Shell controls a page can reach — e.g. the chat header's menu button. */
            interface ContextValue {
                /** Open the navigation drawer (mobile). */
                openNav: () => void;
                /** Desktop sidebar collapsed to its icon rail. */
                collapsed: boolean;
                toggleCollapsed: () => void;
                /** Open the "start a new conversation" agent picker. */
                openNewChat: () => void;
            }
        }
    }
}
