'use client';

import { VStack } from '@chakra-ui/react';
import { RegistrationForm } from './components/forms/registration';

export default function Content() {
    return (
        <VStack minH="dvh" minW="dvw" bg="grey.200" alignItems="center" justifyContent="center">
            <RegistrationForm />
        </VStack>
    );
}
