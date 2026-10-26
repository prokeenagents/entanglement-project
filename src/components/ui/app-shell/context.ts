'use client';

import { createContext, useContext } from 'react';

export const AppShellContext = createContext<App.AppShell.ContextValue | null>(null);

/** Shell controls (open the mobile nav, the new-chat picker…). Throws outside <AppShell>. */
export function useAppShell(): App.AppShell.ContextValue {
    const ctx = useContext(AppShellContext);

    if (ctx === null) {
        throw new Error('useAppShell must be used within an <AppShell>');
    }

    return ctx;
}
