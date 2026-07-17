import Link from 'next/link';
import { Button, Container, Heading, Stack, Text } from '@chakra-ui/react';

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
        <Container maxW="3xl" py={20}>
            <Stack gap={4} align="center" textAlign="center">
                <Heading size="4xl">404</Heading>
                <Text>This page could not be found.</Text>
                <Button asChild>
                    <Link href="/">Go home</Link>
                </Button>
            </Stack>
        </Container>
    );
}
