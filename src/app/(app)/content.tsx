'use client';

import { useConsumer } from '@/contexts/consumer';
import { Box, Button, Card, Container, For, Heading, Stack } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';

/**
 * Client half of the home page. Holds everything that needs the browser —
 * the useLogin hook + the logout handler. `spaces` is read on the server (from
 * the keen cache, which only exists there) and handed down as a serializable
 * prop, so this component never touches getKeen().
 */
export function HomeContent() {
    const consumer = useConsumer();
    const spaces = consumer.consumerSpaces;
    const router = useRouter();

    const navigateToSpace = (id: string) => {
        router.push(`/space/${id}`);
    };

    return (
        <Container maxW="3xl" py={20}>
            <Stack gap={4}>
                <Box>
                    <Heading size="2xl" mb={2}>
                        Your Spaces
                    </Heading>
                </Box>

                <Stack gap="2" direction="row" wrap="wrap">
                    <For each={spaces}>
                        {space => (
                            <Card.Root width="320px" variant="elevated" key={space.id}>
                                <Card.Body>
                                    <Card.Title>{space.title}</Card.Title>
                                    <Card.Description>{space.description || 'Agent space'}</Card.Description>
                                </Card.Body>
                                <Card.Footer justifyContent="flex-end">
                                    <Button onClick={() => navigateToSpace(space.id)}>Agents</Button>
                                </Card.Footer>
                            </Card.Root>
                        )}
                    </For>
                </Stack>
            </Stack>
        </Container>
    );
}
