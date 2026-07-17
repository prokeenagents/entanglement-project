import { Spinner, VStack } from '@chakra-ui/react';

/**
 * Route-level loading UI for every page under (app) — home, space/[id],
 * space/[id]/[agentID]. Next wraps the segment's page in a Suspense boundary
 * with this as the fallback, so it paints instantly on navigation while the
 * server component resolves. A nested segment can override it by adding its own
 * loading.tsx (nearest one wins).
 */
export default function Loading() {
    return (
        <VStack position="fixed" w="dvw" h="dvh" bg="black" top="0" left="0" zIndex="max" justifyContent="center">
            <Spinner size="lg" color="blue.500" />
        </VStack>
    );
}
