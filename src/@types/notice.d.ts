export {};

declare global {
    namespace App {
        namespace Notice {
            /** One thing to tell the user, shown in the blocking notice dialog. */
            interface Notice {
                /** The headline — the whole message when there's nothing more to say. */
                title: string;
                /** Optional detail under the title. */
                message?: string;
            }

            interface ContextValue {
                /**
                 * Raise the notice dialog. Callable from anywhere under the provider —
                 * including a non-React caller like an event handler, which is why this
                 * lives in a context rather than in component state.
                 *
                 * A second call while one is open REPLACES it: these are announcements,
                 * not a queue, and stacking them would trap the user behind a pile of
                 * dialogs they have to dismiss one by one.
                 */
                show: (notice: Notice) => void;
            }
        }
    }
}
