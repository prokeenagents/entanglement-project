'use client';

import { ContentUI } from '@/components/ui/content';
import { Logo } from '@/components/ui/logo';
import { Button, Heading, Separator, Text, VStack } from '@chakra-ui/react';

export default function Content() {
    const refresh = () => {
        if (typeof window !== undefined) {
            window.location.reload();
        }
    };

    return (
        <ContentUI minH="dvh" justifyContent="center">
            <VStack gap="8">
                <VStack gap="4">
                    <Logo />
                    <VStack gap="0" alignItems="center">
                        <Text fontSize="sm" color="cyan.700" lineHeight="1.2">
                            <strong>Entanglement</strong>
                        </Text>
                        <Text fontSize="xs" color="cyan.700" opacity="0.75" lineHeight="1.2">
                            Project
                        </Text>
                    </VStack>

                    <Separator w="full" />

                    <VStack gap="1" alignItems="center" justifyContent="center">
                        <Heading size="4xl">Maintenance</Heading>
                        <Text>The site currently not working</Text>
                        <Button onClick={() => refresh()}>Try again</Button>
                    </VStack>
                </VStack>
            </VStack>
        </ContentUI>
    );
}
