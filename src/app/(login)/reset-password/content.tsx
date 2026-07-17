'use client';

import React from 'react';
import { VStack } from '@chakra-ui/react';
import { ResetPasswordForm } from './components';

export default function Content() {
    return (
        <VStack minH="dvh" minW="dvw" bg="grey.200" alignItems="center" justifyContent="center">
            <ResetPasswordForm />
        </VStack>
    );
}
