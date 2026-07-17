'use client';

import { useState } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { CacheProvider } from '@emotion/react';
import createCache from '@emotion/cache';

/**
 * SSR style registry for emotion — Chakra UI v3's styling engine.
 *
 * Without it, emotion (and especially Chakra's global CSS reset via `<Global>`)
 * streams its `<style data-emotion="css-global …">` INLINE into the `<body>`
 * during SSR, while the client injects the same rules through the stylesheet and
 * renders NO `<style>` node in the tree. React then hydrates a body whose DOM
 * holds `<style>` nodes the client vdom doesn't — the "server rendered `<style>`
 * where the client rendered `<Suspense>`" hydration mismatch, which reappears at
 * whichever boundary emotion happened to insert at.
 *
 * `cache.compat = true` switches emotion to the insert-into-sheet path (so
 * `<Global>` stops emitting an inline `<style>` element), and
 * `useServerInsertedHTML` flushes every style emitted so far into `<head>`. The
 * streamed `<body>` then matches the client tree exactly.
 */
export function EmotionCacheProvider({ children }: { children: React.ReactNode }) {
    const [{ cache, flush }] = useState(() => {
        const cache = createCache({ key: 'css' });
        cache.compat = true;

        const prevInsert = cache.insert;
        let inserted: string[] = [];

        cache.insert = (...args: Parameters<typeof prevInsert>) => {
            const serialized = args[1];
            if (cache.inserted[serialized.name] === undefined) {
                inserted.push(serialized.name);
            }
            return prevInsert(...args);
        };

        const flush = () => {
            const prev = inserted;
            inserted = [];
            return prev;
        };

        return { cache, flush };
    });

    // Server-only: runs once per streamed chunk, emitting just the delta of
    // styles inserted since the last flush into <head>. A no-op on the client.
    useServerInsertedHTML(() => {
        const names = flush();
        if (names.length === 0) {
            return null;
        }

        let styles = '';
        for (const name of names) {
            styles += cache.inserted[name];
        }

        return <style data-emotion={`${cache.key} ${names.join(' ')}`} dangerouslySetInnerHTML={{ __html: styles }} />;
    });

    return <CacheProvider value={cache}>{children}</CacheProvider>;
}
