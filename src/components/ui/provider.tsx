'use client';

import { ChakraProvider } from '@chakra-ui/react';
import { ThemeProvider } from 'next-themes';

import { system } from '@/theme';
import { BRAND } from '@/theme/brand.config';
import { EmotionCacheProvider } from './emotion-cache-provider';

/**
 * EmotionCacheProvider is load-bearing (SSR style registry — see AGENTS.md).
 * ThemeProvider (next-themes) owns light/dark: it puts `.light` / `.dark` on
 * <html>, which is exactly the condition Chakra's `_light` / `_dark` semantic
 * tokens read.
 */
export function Provider({ children }: { children: React.ReactNode }) {
    return (
        <EmotionCacheProvider>
            <ChakraProvider value={system}>
                <ThemeProvider attribute="class" defaultTheme={BRAND.defaultColorMode} enableSystem={BRAND.defaultColorMode === 'system'} disableTransitionOnChange>
                    {children}
                </ThemeProvider>
            </ChakraProvider>
        </EmotionCacheProvider>
    );
}
