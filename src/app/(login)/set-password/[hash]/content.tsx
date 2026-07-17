'use client';

import React from 'react';
import { Container } from '@chakra-ui/react';

/**
 * Receives the SERVER-decoded reset identity from page.tsx: `email` (who the reset
 * is for, safe to show) and the raw `hash` (opaque, for the redeem POST). The
 * sensitive fields — argon password + callbackSecret — never leave the server.
 */
export default function Content(props: React.PropsWithChildren) {
    const { children } = props;

    return (
        <Container maxW="3xl" py={20}>
            {children}
        </Container>
    );
}
