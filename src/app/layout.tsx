import { Suspense } from 'react';
import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Hanken_Grotesk } from 'next/font/google';
import { Provider } from '@/components/ui/provider';
import { BRAND } from '@/theme/brand.config';

// The brand typeface. To change it, swap the import (any next/font/google family)
// and keep the `--font-brand` variable — the theme's `fonts` tokens read it.
const brandFont = Hanken_Grotesk({
    variable: '--font-brand',
    subsets: ['latin', 'latin-ext', 'cyrillic-ext'],
    weight: ['300', '400', '500', '600', '700']
});

const monoFont = Geist_Mono({
    variable: '--font-mono',
    subsets: ['latin']
});

export const metadata: Metadata = {
    title: {
        default: BRAND.name,
        template: `%s · ${BRAND.name}`
    },
    description: BRAND.tagline
};

export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    themeColor: [
        { media: '(prefers-color-scheme: dark)', color: '#0b1322' },
        { media: '(prefers-color-scheme: light)', color: '#e3ecfd' }
    ]
};

export default function RootLayout(props: Readonly<React.PropsWithChildren>) {
    const { children } = props;

    return (
        <html lang="en" suppressHydrationWarning className={`${brandFont.variable} ${monoFont.variable}`}>
            <body>
                <Suspense fallback={null}>
                    <SuspenseShell>{children}</SuspenseShell>
                </Suspense>
            </body>
        </html>
    );
}

async function SuspenseShell(props: Readonly<React.PropsWithChildren>) {
    const { children } = props;

    return (
        <>
            <Provider>{children}</Provider>
        </>
    );
}
