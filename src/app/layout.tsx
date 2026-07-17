import { Suspense } from 'react';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Provider } from '@/components/ui/provider';

const geistSans = Geist({
    variable: '--font-geist-sans',
    subsets: ['latin']
});

const geistMono = Geist_Mono({
    variable: '--font-geist-mono',
    subsets: ['latin']
});

export const metadata: Metadata = {
    title: 'Entanglement',
    description: 'Next.js + Chakra UI 3 playground'
};

export default function RootLayout(props: Readonly<React.PropsWithChildren>) {
    const { children } = props;

    return (
        <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
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
