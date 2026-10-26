'use client';

import { Box, HStack, Heading, Text } from '@chakra-ui/react';

import { ColorModeToggle } from '../color-mode-toggle';
import { Logo } from '../logo';

/**
 * The frosted auth card (sign in, sign up, OTP, reset): logo + theme toggle, a
 * title, a one-line description, the brand divider, then the form.
 */
export const Component: React.FC<
    React.PropsWithChildren<{
        title?: string;
        description?: string;
        /** Card width in px (the form decides; defaults to a sign-in width). */
        width?: number;
    }>
> = props => {
    const { children, title, description, width = 440 } = props;

    return (
        <Box
            className="kn-rise"
            position="relative"
            w="full"
            maxW={`${width}px`}
            px={{ base: '6', md: '8' }}
            pt={{ base: '6', md: '7' }}
            pb={{ base: '6', md: '7' }}
            bg="bg.authCard"
            backdropFilter="blur(18px)"
            borderWidth="1px"
            borderColor="border"
            borderRadius="panel"
            boxShadow="pop, 0 0 0 1px var(--chakra-colors-brand-subtle)"
        >
            <HStack justify="space-between" mb="5">
                <Logo height={28} />
                <ColorModeToggle size="xs" />
            </HStack>

            {(title || description) && (
                <Box mb="5">
                    {title && (
                        <Heading as="h1" fontSize="xl" fontWeight="700" letterSpacing="-0.02em">
                            {title}
                        </Heading>
                    )}
                    {description && (
                        <Text color="fg.muted" fontSize="sm" mt="1" lineHeight="1.6">
                            {description}
                        </Text>
                    )}
                </Box>
            )}

            <Box h="1px" mb="6" bgImage="linear-gradient(90deg, transparent, var(--chakra-colors-brand-border), transparent)" aria-hidden="true" />

            {children}
        </Box>
    );
};

Component.displayName = 'CardShell';
