'use client';

import Link from 'next/link';
import { Box, Stack, Text, type BoxProps } from '@chakra-ui/react';

/**
 * The card primitive. Every panel in the app is a Surface, so its look (fill,
 * line, radius, shadow) is changed in ONE place — or via the tokens it reads
 * (`bg.panel`, `border`, `radii.card`, `shadows.card`).
 */
export const Surface = ({ children, ...rest }: BoxProps) => (
    <Box bg="bg.panel" borderWidth="1px" borderColor="border" borderRadius="card" boxShadow="card" {...rest}>
        {children}
    </Box>
);

/** A Surface that is one big link, with the brand-glow hover from the Keen system. */
export const LinkSurface = ({ href, children, ...rest }: BoxProps & { href: string }) => (
    <Link href={href} style={{ display: 'block', height: '100%' }}>
        <Surface
            h="full"
            transition="border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease"
            _hover={{ borderColor: 'brand.border', boxShadow: 'card, 0 0 24px -6px var(--chakra-colors-brand-glow)', transform: 'translateY(-1px)' }}
            css={{ 'a:focus-visible > &': { outline: '2px solid var(--chakra-colors-brand-500)', outlineOffset: '2px' } }}
            {...rest}
        >
            {children}
        </Surface>
    </Link>
);

/** A small number + label tile. */
export const StatTile = ({ label, value, icon }: { label: string; value: React.ReactNode; icon: React.ReactNode }) => (
    <Surface px={{ base: '3', sm: '4' }} py="3.5" boxShadow="none" bg="bg.subtle">
        <Stack direction={{ base: 'column', sm: 'row' }} gap={{ base: '1.5', sm: '3' }} align={{ base: 'flex-start', sm: 'center' }}>
            <Box color="brand.fg">{icon}</Box>
            <Box>
                <Text fontSize="xl" fontWeight="700" letterSpacing="-0.02em" lineHeight="1.1">
                    {value}
                </Text>
                <Text fontSize="xs" color="fg.muted">
                    {label}
                </Text>
            </Box>
        </Stack>
    </Surface>
);
