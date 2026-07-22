'use client';

import { createContext, useCallback, useContext, useMemo, useState } from 'react';

import { NoticeDialog } from '@/components/ui/notice-dialog';

/**
 * Owns the ONE blocking notice dialog for the app, and hands out `show()` so anything
 * under it can raise one.
 *
 * Why a context and not local state in whoever needs it: the callers aren't
 * components. A server→client event handler (contexts/events/handlers/*) is a plain
 * function — it has no render of its own to put a dialog in, so it needs a way to
 * reach one that is already mounted. Same for anything else that wants to say
 * something from outside the tree it happens to be in.
 *
 * Mounted ABOVE EventsProvider in (app)/layout.tsx, since the events loop passes
 * `show` down to every handler.
 */
const NoticeContext = createContext<App.Notice.ContextValue | null>(null);

export function NoticeProvider({ children }: React.PropsWithChildren) {
    const [notice, setNotice] = useState<App.Notice.Notice | null>(null);
    const [open, setOpen] = useState(false);

    const show = useCallback((next: App.Notice.Notice) => {
        setNotice(next);
        setOpen(true);
    }, []);

    // Only flip `open` — the notice itself stays in state so its text doesn't vanish
    // mid close-animation.
    const close = useCallback(() => setOpen(false), []);

    const context = useMemo<App.Notice.ContextValue>(() => ({ show }), [show]);

    return (
        <NoticeContext.Provider value={context}>
            {children}
            <NoticeDialog open={open} title={notice?.title ?? ''} message={notice?.message} onClose={close} />
        </NoticeContext.Provider>
    );
}

/**
 * Raise a notice from anywhere under the provider. Throws outside one, so a missing
 * provider is a loud dev-time error rather than a silently swallowed message.
 */
export function useNotice(): App.Notice.ContextValue {
    const ctx = useContext(NoticeContext);

    if (ctx === null) {
        throw new Error('useNotice must be used within a <NoticeProvider>');
    }

    return ctx;
}
