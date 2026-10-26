'use client';

import { VStack } from '@chakra-ui/react';
import { RegistrationForm } from './components/forms/registration';

export default function Content() {
    return (
        <VStack w="full" alignItems="center" justifyContent="center">
            <RegistrationForm />
        </VStack>
    );
}
