'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Badge, Box, Button, Flex, Grid, HStack, Text } from '@chakra-ui/react';
import { LuBoxes, LuHistory, LuMessageSquarePlus } from 'react-icons/lu';

import { AgentAvatar, SpaceIcon } from '@/components/ui/agent-avatar';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { Surface } from '@/components/ui/surface';
import { useChatList } from '@/contexts/chat-list';
import { useConsumer } from '@/contexts/consumer';
import { agentHref, newChatHref } from '@/utils/routes';
import { formatRelative } from '@/utils/time';

/**
 * One space: what it is for and the agents in it. Each agent card offers a new
 * conversation straight away, or its history. Disabled agents stay visible (so
 * nobody wonders where they went) but can't be started.
 */
export const Content: React.FC<{
    spaceID: string;
}> = props => {
    const { spaceID } = props;

    const router = useRouter();
    const consumer = useConsumer();
    const { entries } = useChatList();

    const space = consumer.consumerSpaces.find(s => s.id === spaceID);

    if (!space) {
        return (
            <PageContainer>
                <EmptyState
                    icon={<LuBoxes size={22} />}
                    title="Space not found"
                    description="This space doesn't exist, or you don't have access to it."
                    action={
                        <Button asChild size="sm">
                            <Link href="/">Back to home</Link>
                        </Button>
                    }
                />
            </PageContainer>
        );
    }

    // Available first, then alphabetical.
    const agents = [...space.agents].sort((a, b) => Number(b.active) - Number(a.active) || a.displayName.localeCompare(b.displayName));
    const activeCount = agents.filter(agent => agent.active).length;

    return (
        <PageContainer>
            <PageHeader
                breadcrumbs={[{ label: 'Home', href: '/' }, { label: space.title }]}
                media={<SpaceIcon size={56} />}
                eyebrow="Space"
                title={space.title}
                description={space.description || 'An agent space.'}
            />

            <HStack justify="space-between" mb="4">
                <Text fontSize="lg" fontWeight="600" letterSpacing="-0.01em">
                    Agents
                </Text>
                <Text fontSize="sm" color="fg.muted">
                    {activeCount} of {agents.length} available
                </Text>
            </HStack>

            {agents.length === 0 ? (
                <EmptyState icon={<LuBoxes size={22} />} title="No agents in this space" description="Agents added to this space will appear here." />
            ) : (
                <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }} gap="4">
                    {agents.map(agent => {
                        const chats = entries.filter(entry => entry.agent?.id === agent.id);
                        const last = chats[0];

                        return (
                            <Surface key={agent.id} p="5" opacity={agent.active ? 1 : 0.62} className="kn-rise">
                                <Flex direction="column" h="full" gap="4">
                                    <HStack gap="3.5" align="flex-start">
                                        <AgentAvatar name={agent.displayName} size={48} online={agent.active} />
                                        <Box flex="1" minW="0">
                                            <Text fontSize="md" fontWeight="600" truncate>
                                                {agent.displayName}
                                            </Text>
                                            <HStack gap="2" mt="1">
                                                {agent.active ? (
                                                    <Badge colorPalette="green" variant="subtle" size="sm">
                                                        Available
                                                    </Badge>
                                                ) : (
                                                    <Badge colorPalette="gray" variant="subtle" size="sm">
                                                        Unavailable
                                                    </Badge>
                                                )}
                                            </HStack>
                                        </Box>
                                    </HStack>

                                    <Text fontSize="sm" color="fg.muted" flex="1" suppressHydrationWarning>
                                        {chats.length === 0
                                            ? 'No conversations yet.'
                                            : `${chats.length} ${chats.length === 1 ? 'conversation' : 'conversations'} · last ${formatRelative(last.chat.updatedAt)}`}
                                    </Text>

                                    <HStack gap="2">
                                        <Button flex="1" size="sm" disabled={!agent.active} onClick={() => router.push(newChatHref(space.id, agent.id))}>
                                            <LuMessageSquarePlus /> New chat
                                        </Button>
                                        <Button flex="1" size="sm" variant="outline" disabled={!agent.active} asChild={agent.active}>
                                            {agent.active ? (
                                                <Link href={agentHref(space.id, agent.id)}>
                                                    <LuHistory /> History
                                                </Link>
                                            ) : (
                                                <>
                                                    <LuHistory /> History
                                                </>
                                            )}
                                        </Button>
                                    </HStack>
                                </Flex>
                            </Surface>
                        );
                    })}
                </Grid>
            )}
        </PageContainer>
    );
};
