'use client';

import { Box, Center, type BoxProps } from '@chakra-ui/react';
import { LuBot, LuBoxes } from 'react-icons/lu';

/**
 * Identity marks, all on the brand tint so they re-color with the accent:
 *
 *   <AgentAvatar name="Order Assistant" />   initials in a rounded square
 *   <SpaceIcon />                             the space glyph
 *   <UserAvatar name="Alex Morgan" />         the signed-in person, round + solid
 */

const initialsOf = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase())
        .join('') || '?';

type AvatarProps = BoxProps & {
    name?: string;
    size?: number;
    /** Show a presence dot in the corner. */
    online?: boolean;
    /** Render the bot glyph instead of initials. */
    icon?: boolean;
};

export const AgentAvatar = ({ name = '', size = 36, online, icon, ...rest }: AvatarProps) => (
    <Box position="relative" flexShrink={0} w={`${size}px`} h={`${size}px`} {...rest}>
        <Center
            w="full"
            h="full"
            borderRadius={`calc(var(--chakra-radii-control) * ${size >= 48 ? 1.2 : 0.85})`}
            bg="brand.subtle"
            borderWidth="1px"
            borderColor="brand.border"
            color="brand.fg"
            fontWeight="700"
            fontSize={`${Math.round(size * 0.36)}px`}
            letterSpacing="-0.02em"
            aria-hidden="true"
        >
            {icon ? <LuBot size={Math.round(size * 0.55)} /> : initialsOf(name)}
        </Center>
        {online !== undefined && (
            <Box
                position="absolute"
                bottom="-2px"
                right="-2px"
                w={`${Math.max(9, Math.round(size * 0.26))}px`}
                h={`${Math.max(9, Math.round(size * 0.26))}px`}
                borderRadius="full"
                bg={online ? 'green.500' : 'fg.subtle'}
                borderWidth="2px"
                borderColor="bg.canvas"
                boxShadow={online ? '0 0 8px var(--chakra-colors-green-500)' : undefined}
            />
        )}
    </Box>
);

export const SpaceIcon = ({ size = 40, ...rest }: BoxProps & { size?: number }) => (
    <Center flexShrink={0} w={`${size}px`} h={`${size}px`} borderRadius="control" bg="brand.subtle" borderWidth="1px" borderColor="brand.border" color="brand.fg" aria-hidden="true" {...rest}>
        <LuBoxes size={Math.round(size * 0.5)} />
    </Center>
);

export const UserAvatar = ({ name = '', size = 34, ...rest }: AvatarProps) => (
    <Center
        flexShrink={0}
        w={`${size}px`}
        h={`${size}px`}
        borderRadius="full"
        bgImage="var(--chakra-gradients-brand)"
        color="white"
        fontWeight="700"
        fontSize={`${Math.round(size * 0.38)}px`}
        boxShadow="0 0 0 3px var(--chakra-colors-brand-subtle)"
        aria-hidden="true"
        {...rest}
    >
        {initialsOf(name)}
    </Center>
);
