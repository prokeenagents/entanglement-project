'use client';

import { useState } from 'react';

import { useConsumer } from '@/contexts/consumer';
import { generateUUID } from '@/utils/global';
import { Alert, Button, Card, Container, Editable, Heading, HStack, Separator, Stack, VStack } from '@chakra-ui/react';
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

    /**
     * Local, optimistic copy of the server-fetched chat list so a delete drops the
     * row immediately. The server list already excludes archived chats, so on the
     * next mount this state and the server agree — no refresh needed.
     */
    const [chats, setChats] = useState(chatList);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    /**
     * Archive a chat (soft-delete, owner-scoped upstream). Optimistic: on success
     * drop the row; on failure keep it and surface the reason.
     */
    const deleteChat = async (chatId: string) => {
        setDeletingId(chatId);
        setError(null);

        try {
            const reply = await consumer.chat.delete(chatId);

            if (reply.success) {
                setChats(prev => prev.filter(c => c.chatId !== chatId));
            } else {
                setError(reply.message ?? 'Could not delete the chat.');
            }
        } catch {
            setError('Could not delete the chat.');
        } finally {
            setDeletingId(null);
        }
    };

    /**
     * Persist a renamed title (double-click → edit → commit on Enter/blur). No-op
     * when blank or unchanged from what's shown — the Editable's fallback preview is
     * the chatId, so committing an untouched untitled chat must NOT save the id as a
     * title. Optimistic: update local state on success so the new title sticks.
     */
    const renameChat = async (chatId: string, rawTitle: string) => {
        const title = rawTitle.trim();
        const current = chats.find(c => c.chatId === chatId);
        const shown = current?.title || chatId;

        if (!title || title === shown) {
            return;
        }

        setError(null);

        try {
            const reply = await consumer.chat.setTitle(chatId, title);

            if (reply.success) {
                setChats(prev => prev.map(c => (c.chatId === chatId ? { ...c, title } : c)));
            } else {
                setError(reply.message ?? 'Could not rename the chat.');
            }
        } catch {
            setError('Could not rename the chat.');
        }
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

                {error && (
                    <Alert.Root status="error">
                        <Alert.Indicator />
                        <Alert.Title>{error}</Alert.Title>
                    </Alert.Root>
                )}

                {!chats.length && (
                    <Alert.Root status="warning">
                        <Alert.Indicator />
                        <Alert.Title>
                            No available chats with <strong>{agent.displayName}</strong>
                        </Alert.Title>
                    </Alert.Root>
                )}

                {chats.length > 0 && (
                    <>
                        <Heading>Chat List</Heading>
                        <VStack w="full">
                            {chats.map(chat => {
                                return (
                                    <Card.Root key={chat.chatId} w="full" size="sm">
                                        <Card.Body>
                                            <HStack>
                                                {/* Double-click the title to rename; Enter/blur commits → setTitle. */}
                                                <Editable.Root
                                                    flex="1"
                                                    defaultValue={chat.title || chat.chatId}
                                                    activationMode="dblclick"
                                                    onValueCommit={details => void renameChat(chat.chatId, details.value)}
                                                >
                                                    <Editable.Preview />
                                                    <Editable.Input />
                                                </Editable.Root>
                                                <Button onClick={() => startChat(chat.chatId)}>Continue</Button>
                                                <Button
                                                    colorPalette="red"
                                                    variant="outline"
                                                    loading={deletingId === chat.chatId}
                                                    onClick={() => void deleteChat(chat.chatId)}
                                                >
                                                    Delete
                                                </Button>
                                            </HStack>
                                        </Card.Body>
                                    </Card.Root>
                                );
                            })}
                        </VStack>
                    </>
                )}
            </Stack>
        </Container>
    );
};
