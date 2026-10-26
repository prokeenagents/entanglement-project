'use client';

import { useCallback, useEffect, useState } from 'react';

import { LocalStorage } from '@/utils/localStorage';

/**
 * useState that remembers its value in localStorage — for per-viewer UI
 * preferences (sidebar collapsed, steps shown) that should survive a reload.
 *
 * Renders `fallback` on the server and the first client pass (so hydration
 * matches), then adopts the stored value right after mount.
 */
export function usePersistentState<T>(key: string, fallback: T): [T, (next: T) => void] {
    const [value, setValue] = useState<T>(fallback);

    useEffect(() => {
        const stored = LocalStorage.getJson<T>(key);

        if (stored !== null) {
            // One-time client-only seed after hydration (see the login content for the same pattern).
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setValue(stored);
        }
    }, [key]);

    const update = useCallback(
        (next: T) => {
            setValue(next);
            LocalStorage.setJson(key, next);
        },
        [key]
    );

    return [value, update];
}
