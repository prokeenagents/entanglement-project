import { Center, Spinner, Stack, Text } from '@chakra-ui/react';

/**
 * Route-level loading UI for every page under (app). Next wraps the segment's
 * page in a Suspense boundary with this as the fallback, so it paints instantly
 * on navigation while the server component resolves — inside the app shell, so
 * the sidebar stays put. A nested segment can override it with its own
 * loading.tsx (nearest one wins).
 */
export default function Loading() {
    return (
        <Center h="full" minH="60dvh">
            <Stack align="center" gap="3">
                <Spinner size="md" color="brand.solid" />
                <Text fontSize="sm" color="fg.muted">
                    Loading…
                </Text>
            </Stack>
        </Center>
    );
}
