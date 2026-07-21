import Link from 'next/link';
import { Button, Heading, Separator, Text, VStack } from '@chakra-ui/react';
import { Logo } from '@/components/ui/logo';
import { ContentUI } from '@/components/ui/content';

/**
 * Catch-all 404. `[...not_found]` matches every route not handled by a more
 * specific one, so this renders for any unknown URL. It lives in the
 * `(not-found)` route group so it gets its own layout/template shell.
 *
 * Note: a catch-all resolves as a real route match, so it responds HTTP 200
 * (a "soft" 404). Call notFound() here if you need a true 404 status code.
 */
export default function Page() {
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
                        <Heading size="4xl">404</Heading>
                        <Text>This page could not be found.</Text>
                        <Button asChild>
                            <Link href="/">Go home</Link>
                        </Button>
                    </VStack>
                </VStack>
            </VStack>
        </ContentUI>
    );
}
