'use client';

import { useConsumer } from '@/contexts/consumer';
import { useLogin } from '@/hooks/login';
import { generateUUID } from '@/utils/global';
import { Alert, Box, Button, Card, Container, Flex, For, Heading, HStack, Separator, Stack, Text, VStack } from '@chakra-ui/react';
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
    chatList: Keen.ChatListItem[];
}> = props => {
    const { spaceID, agentID, chatList } = props;

    const consumer = useConsumer();
    const spaces = consumer.consumerSpaces;
    const router = useRouter();

    const navigateToSpaces = () => {
        router.push(`/`);
    };

    const navigateToAgent = () => {
        router.push(`/space/${spaceID}`);
    };

    const startNewChat = () => {
        const chatID = generateUUID();
        router.push(`/space/${spaceID}/${agentID}/${chatID}`);
    };

    const startChat = (chatID: string) => {
        router.push(`/space/${spaceID}/${agentID}/${chatID}`);
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

    return (
        <Container maxW="3xl" py={20}>
            <Stack gap={4}>
                <Button colorPalette="blue" onClick={() => navigateToSpaces()}>
                    Go to Spaces
                </Button>
                <Button colorPalette="blue" onClick={() => navigateToAgent()}>
                    Go to Space Agents
                </Button>

                <Separator w="full" />

                <Button colorPalette="blue" onClick={() => startNewChat()}>
                    Start new conversation
                </Button>

                <Separator w="full" />

                {!chatList.length && (
                    <Alert.Root status="warning">
                        <Alert.Indicator />
                        <Alert.Title>
                            No available chats with <strong>{agent.displayName}</strong>
                        </Alert.Title>
                    </Alert.Root>
                )}

                {chatList.length && (
                    <>
                        <VStack>
                            {chatList.map(chat => {
                                return (
                                    <HStack key={chat.chatId}>
                                        <Text>{chat.title || chat.chatId}</Text>
                                        <Button onClick={() => startChat(chat.chatId)}>Continue</Button>
                                    </HStack>
                                );
                            })}
                        </VStack>
                    </>
                )}
            </Stack>
        </Container>
    );
};
