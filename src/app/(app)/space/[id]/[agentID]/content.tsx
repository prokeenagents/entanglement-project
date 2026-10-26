'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Box, Button, HStack, Input, InputGroup, Stack, Text } from '@chakra-ui/react';
import { LuBot, LuMessageSquarePlus, LuMessagesSquare, LuSearch } from 'react-icons/lu';

import { AgentAvatar } from '@/components/ui/agent-avatar';
import { ChatNavItem } from '@/components/ui/app-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { Surface } from '@/components/ui/surface';
import { useChatList } from '@/contexts/chat-list';
import { useConsumer } from '@/contexts/consumer';
import { newChatHref, spaceHref } from '@/utils/routes';

/**
 * One agent: start a new conversation, or find, rename and delete an earlier one.
 * The list is the shared ChatListProvider state, so edits here show up in the
 * sidebar at the same time.
 */
export const Content: React.FC<{
    spaceID: string;
    agentID: string;
}> = props => {
    const { spaceID, agentID } = props;

    const router = useRouter();
    const consumer = useConsumer();
    const { entries } = useChatList();
    const [query, setQuery] = useState('');

    const space = consumer.consumerSpaces.find(s => s.id === spaceID);
    const agent = space?.agents.find(a => a.id === agentID && a.active);

    const chats = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return entries.filter(entry => entry.agent?.id === agentID && (!needle || (entry.chat.title ?? '').toLowerCase().includes(needle)));
    }, [entries, agentID, query]);

    if (!space || !agent) {
        return (
            <PageContainer>
                <EmptyState
                    icon={<LuBot size={22} />}
                    title="Agent not available"
                    description="This agent doesn't exist, is disabled, or you don't have access to it."
                    action={
                        <Button asChild size="sm">
                            <Link href={space ? spaceHref(space.id) : '/'}>{space ? `Back to ${space.title}` : 'Back to home'}</Link>
                        </Button>
                    }
                />
            </PageContainer>
        );
    }

    const total = entries.filter(entry => entry.agent?.id === agentID).length;
    const startNewChat = () => router.push(newChatHref(spaceID, agentID));

    return (
        <PageContainer maxW="4xl">
            <PageHeader
                breadcrumbs={[{ label: 'Home', href: '/' }, { label: space.title, href: spaceHref(space.id) }, { label: agent.displayName }]}
                media={<AgentAvatar name={agent.displayName} size={60} online />}
                eyebrow={space.title}
                title={agent.displayName}
                description={
                    <HStack as="span" gap="2" display="inline-flex">
                        <Badge colorPalette="green" variant="subtle" size="sm">
                            Available
                        </Badge>
                        <Text as="span">
                            {total} {total === 1 ? 'conversation' : 'conversations'}
                        </Text>
                    </HStack>
                }
                actions={
                    <Button onClick={startNewChat} boxShadow="glow">
                        <LuMessageSquarePlus /> New conversation
                    </Button>
                }
            />

            {total === 0 ? (
                <EmptyState
                    icon={<LuMessagesSquare size={22} />}
                    title={`No conversations with ${agent.displayName} yet`}
                    description="Start one now — it will be saved here so you can come back to it any time."
                    action={
                        <Button onClick={startNewChat} size="sm">
                            <LuMessageSquarePlus /> Start a conversation
                        </Button>
                    }
                />
            ) : (
                <Stack gap="4">
                    <HStack justify="space-between" gap="3" flexWrap="wrap">
                        <Text fontSize="lg" fontWeight="600" letterSpacing="-0.01em">
                            Conversations
                        </Text>
                        <InputGroup startElement={<LuSearch size={15} />} maxW={{ base: 'full', sm: '280px' }}>
                            <Input size="sm" placeholder="Search by title" value={query} onChange={event => setQuery(event.target.value)} aria-label="Search conversations" bg="bg.glass" />
                        </InputGroup>
                    </HStack>

                    <Surface p="1.5">
                        {chats.length === 0 ? (
                            <Text color="fg.muted" fontSize="sm" textAlign="center" py="8">
                                No conversations match “{query}”.
                            </Text>
                        ) : (
                            <Stack gap="0.5">
                                {chats.map(entry => (
                                    <ChatNavItem key={entry.chat.chatId} entry={entry} active={false} showAgent={false} showTime size="md" />
                                ))}
                            </Stack>
                        )}
                    </Surface>

                    <Box>
                        <Text fontSize="xs" color="fg.subtle">
                            Tip: use the ··· menu on a conversation to rename or delete it.
                        </Text>
                    </Box>
                </Stack>
            )}
        </PageContainer>
    );
};
