'use client';

import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { EmotionCacheProvider } from './emotion-cache-provider';

export function Provider({ children }: { children: React.ReactNode }) {
    return (
        <EmotionCacheProvider>
            <ChakraProvider value={defaultSystem}>{children}</ChakraProvider>
        </EmotionCacheProvider>
    );
}
