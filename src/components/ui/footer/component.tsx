'use client';

import { HStack, Separator, Text } from '@chakra-ui/react';

import { BRAND } from '@/theme/brand.config';
import { ColorModeToggle } from '../color-mode-toggle';

/** The slim credit bar under guest screens: brand line · theme toggle. */
export const Component: React.FC = () => {
    const year = new Date().getFullYear();

    return (
        <HStack
            as="footer"
            w="full"
            h="14"
            justify="center"
            gap="4"
            flexShrink={0}
            bg="bg.bar"
            backdropFilter="blur(22px) saturate(155%)"
            borderTopWidth="1px"
            borderColor="border"
            pb="env(safe-area-inset-bottom)"
        >
            <Text fontSize="xs" fontWeight="600" color="fg.muted" suppressHydrationWarning>
                © {year} {BRAND.name}
            </Text>
            {BRAND.poweredBy && (
                <>
                    <Separator orientation="vertical" h="4" />
                    <Text fontSize="xs" color="fg.subtle" display={{ base: 'none', sm: 'block' }}>
                        {BRAND.poweredBy}
                    </Text>
                </>
            )}
            <Separator orientation="vertical" h="4" />
            <ColorModeToggle size="xs" />
        </HStack>
    );
};

Component.displayName = 'Footer';
