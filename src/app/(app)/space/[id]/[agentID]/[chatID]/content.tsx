'use client';

import { ChatMessages } from '@/components/ui-chat/chat-messages';
import { ChatPrompt } from '@/components/ui-chat/chat-prompt';
import { ChatShell } from '@/components/ui-chat/chat-shell';
import { useConsumer } from '@/contexts/consumer';
import { Button, Card, Container, Stack, Text } from '@chakra-ui/react';
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
    chatID: string;
    consumerData: Keen.ConsumerData;
}> = props => {
    const { spaceID, agentID, chatID, consumerData } = props;

    const consumer = useConsumer();
    const spaces = consumer.consumerSpaces;
    const router = useRouter();

    const selectedAgent = consumer.agents.find(a => a.active && a.id === agentID);
    const agentSlugID = selectedAgent?.agentId;

    const navigateToSpaces = () => {
        router.push(`/`);
    };

    const navigateToAgent = () => {
        router.push(`/space/${spaceID}`);
    };

    const navigateToChats = () => {
        router.push(`/space/${spaceID}/${selectedAgent?.id}`);
    };

    const space = spaces.find(s => s.id === spaceID);

    if (!space) {
        return <>This space does not exists or you dont have access to it.</>;
    }

    const agents = space.agents.filter(a => a.active);
    if (!agents || !agents.length) {
        return <>There is no available agents in this space.</>;
    }

    const agent = agents.find(a => a.id === agentID);
    if (!agent) {
        return <>This agent does not exists or you dont have access to it.</>;
    }

    if (!agentSlugID) {
        return <>Something went wrong.</>;
    }

    return (
        <Container maxW="3xl" py={20}>
            <Card.Root>
                <Card.Body>
                    <Stack gap={4}>
                        <Button colorPalette="blue" onClick={() => navigateToSpaces()}>
                            Go to Spaces
                        </Button>
                        <Button colorPalette="blue" onClick={() => navigateToAgent()}>
                            Go to Space Agents
                        </Button>

                        <Button colorPalette="blue" onClick={() => navigateToChats()}>
                            Go to Chats with this agent
                        </Button>
                    </Stack>
                </Card.Body>
            </Card.Root>

            <ChatShell chatID={chatID} agentID={agentID} spaceID={spaceID} consumerData={consumerData}>
                <ChatMessages />
                <ChatPrompt />
            </ChatShell>
        </Container>
    );
};
