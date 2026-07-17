'use client';

import { useConsumer } from '@/contexts/consumer';
import { useLogin } from '@/hooks/login';
import { Box, Button, Card, Container, Flex, For, Heading, HStack, Separator, Stack, Text, VStack } from '@chakra-ui/react';
import { useRouter } from 'next/navigation';

/**
 * Client half of the home page. Holds everything that needs the browser —
 * the useLogin hook + the logout handler. `spaces` is read on the server (from
 * the keen cache, which only exists there) and handed down as a serializable
 * prop, so this component never touches getKeen().
 */
export const Content: React.FC<{
    spaceID: string;
}> = props => {
    const { spaceID } = props;

    const consumer = useConsumer();
    const spaces = consumer.consumerSpaces;
    const router = useRouter();

    const navigateToAgent = (spaceID: string, agentID: string) => {
        router.push(`/space/${spaceID}/${agentID}`);
    };

    const space = spaces.find(s => s.id === spaceID);

    if (!space) {
        return <>This space does not exists or you dont have access to it.</>;
    }

    const agents = space.agents.filter(a => a.active);

    return (
        <Container maxW="3xl" py={20}>
            <Stack gap={4}>
                <Box>
                    <Heading size="2xl" mb={2}>
                        Available Agents
                    </Heading>
                    <Text color="fg.muted">
                        You see the available agents in <strong>{space.title}</strong>
                    </Text>
                </Box>
                <Separator w="full" />

                <VStack gap="2" w="full" alignItems="flex-start">
                    <Button onClick={async () => router.push('/')}>Back to Spaces</Button>
                </VStack>

                <Stack gap="2" direction="row" wrap="wrap">
                    <For each={agents}>
                        {agent => (
                            <Card.Root width="320px" variant="elevated" key={agent.id}>
                                <Card.Body>
                                    <Card.Title>{agent.displayName}</Card.Title>
                                </Card.Body>
                                <Card.Footer justifyContent="flex-end">
                                    <Button onClick={() => navigateToAgent(space.id, agent.id)}>Chat with</Button>
                                </Card.Footer>
                            </Card.Root>
                        )}
                    </For>
                </Stack>
            </Stack>
        </Container>
    );
};
