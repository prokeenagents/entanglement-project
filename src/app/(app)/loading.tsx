import { Logo } from '@/components/ui/logo';
import { Spinner, Text, VStack } from '@chakra-ui/react';

/**
 * Route-level loading UI for every page under (app) — home, space/[id],
 * space/[id]/[agentID]. Next wraps the segment's page in a Suspense boundary
 * with this as the fallback, so it paints instantly on navigation while the
 * server component resolves. A nested segment can override it by adding its own
 * loading.tsx (nearest one wins).
 */
export default function Loading() {
    return (
        <VStack position="fixed" w="dvw" h="dvh" top="0" left="0" zIndex="max" justifyContent="center" backdropFilter="blur(3px) saturate(.25)">
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

                    <VStack gap="1" alignItems="center" justifyContent="center">
                        <Spinner size="md" color="blue.500" />
                        <Text>Loading ...</Text>
                    </VStack>
                </VStack>
            </VStack>
        </VStack>
    );
}
