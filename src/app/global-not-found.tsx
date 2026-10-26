import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Provider } from '@/components/ui/provider';
import { GuestLayout } from '@/components/ui/guest-layout';
import { StatusCard } from '@/components/ui/status-card';
import { BRAND } from '@/theme/brand.config';

/**
 * The 404 for any URL no route matches, answered with a real HTTP 404.
 *
 * It replaces the old `[...not_found]` catch-all page: a catch-all is a route
 * match, and the root layout streams every page through <Suspense>, so it could
 * only ever answer 200 (a soft 404). global-not-found renders WITHOUT the root
 * layout, which is why it repeats the document, the brand font and the Provider.
 * Enabled by `experimental.globalNotFound` in next.config.ts.
 */
const brandFont = Inter({
    variable: '--font-brand',
    subsets: ['latin', 'latin-ext', 'cyrillic', 'cyrillic-ext']
});

export const metadata: Metadata = {
    title: `Page not found · ${BRAND.name}`
};

export default function GlobalNotFound() {
    return (
        <html lang="en" suppressHydrationWarning className={brandFont.variable}>
            <body>
                <Provider>
                    <GuestLayout>
                        <StatusCard tone="lost" title="Page not found" message="The page you're looking for doesn't exist or has moved." actionLabel="Go home" actionHref="/" />
                    </GuestLayout>
                </Provider>
            </body>
        </html>
    );
}
