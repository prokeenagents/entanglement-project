'use client';

import { Flex } from '@chakra-ui/react';

import { HexBackground } from '../hex-background';

/**
 * The frame for every screen OUTSIDE the app — sign in, sign up, OTP, password
 * reset, maintenance, 404: the hex atmosphere behind a centered column.
 */
export const Component: React.FC<React.PropsWithChildren> = props => {
    const { children } = props;

    return (
        <>
            <HexBackground />
            <Flex position="relative" zIndex="1" direction="column" w="full" minH="100dvh">
                {children}
            </Flex>
        </>
    );
};

Component.displayName = 'PageShell';
