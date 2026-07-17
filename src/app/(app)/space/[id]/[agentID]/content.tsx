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
    agentID: string;
}> = props => {
    const { spaceID, agentID } = props;

    const consumer = useConsumer();
    const spaces = consumer.consumerSpaces;
    const router = useRouter();

    const navigateToSpaces = () => {
        router.push(`/`);
    };

    const navigateToAgent = () => {
        router.push(`/space/${spaceID}`);
    };

    const space = spaces.find(s => s.id === spaceID);

    if (!space) {
        return <>This space does not exists or you dont have access to it.</>;
    }

    const agents = space.agents.filter(a => a.active);
    if (!agents || !agents.length) {
        return <>There is no available agents in this space.</>;
    }

    const agent = agents.filter(a => a.id === agentID);
    if (!agent || !agent.length) {
        return <>This agent does not exists or you dont have access to it.</>;
    }

    return (
        <Container maxW="3xl" py={20}>
            <Stack gap={4}>
                <Box>
                    <Heading size="2xl" mb={2}>
                        Entanglement
                    </Heading>
                    <Text color="fg.muted">Next.js 16 · React 19 · Chakra UI 3 · TypeScript</Text>
                </Box>
                <Separator w="full" />
                <Button colorPalette="blue" onClick={() => navigateToSpaces()}>
                    Go to Spaces
                </Button>
                <Button colorPalette="blue" onClick={() => navigateToAgent()}>
                    Go to Space Agents
                </Button>
                Start
            </Stack>
        </Container>
    );
};
