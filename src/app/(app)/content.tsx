'use client';

import { useSyncExternalStore } from 'react';
import { Box, Button, Flex, Grid, HStack, Heading, SimpleGrid, Text } from '@chakra-ui/react';
import { LuArrowRight, LuBot, LuBoxes, LuMessageSquarePlus, LuMessagesSquare } from 'react-icons/lu';

import { AgentAvatar, SpaceIcon } from '@/components/ui/agent-avatar';
import { useAppShell } from '@/components/ui/app-shell';
import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { LinkSurface, StatTile } from '@/components/ui/surface';
import { useAuth } from '@/contexts/auth';
import { useChatList } from '@/contexts/chat-list';
import { useConsumer } from '@/contexts/consumer';
import { spaceHref } from '@/utils/routes';
import { formatRelative, greeting } from '@/utils/time';

const RECENT_LIMIT = 4;

const noopSubscribe = () => () => {};

/**
 * The time-of-day greeting from the VIEWER's clock. Server-rendering it would use
 * the server's timezone and stick (hydration keeps server text), so the server and
 * first client pass say "Welcome back" and the real greeting lands after hydration.
 */
const useGreeting = () =>
    useSyncExternalStore(
        noopSubscribe,
        () => greeting(),
        () => 'Welcome back'
    );

const SectionTitle = ({ title, hint }: { title: string; hint?: string }) => (
    <HStack justify="space-between" align="baseline" mb="4">
        <Heading as="h2" fontSize="lg" fontWeight="600" letterSpacing="-0.01em">
            {title}
        </Heading>
        {hint && (
            <Text fontSize="sm" color="fg.muted">
                {hint}
            </Text>
        )}
    </HStack>
);

/**
 * Home: a greeting, where you left off, and every space you can enter. Everything
 * comes from the server snapshot (useConsumer) + the shared conversation list.
 */
export function HomeContent() {
    const consumer = useConsumer();
    const { identity } = useAuth();
    const { entries } = useChatList();
    const { openNewChat } = useAppShell();
    const hello = useGreeting();

    const spaces = consumer.consumerSpaces;
    const activeAgents = consumer.agents.filter(agent => agent.active);
    const firstName = identity?.username?.split(' ')[0];
    const recent = entries.filter(entry => entry.href).slice(0, RECENT_LIMIT);

    return (
        <PageContainer>
            <PageHeader
                eyebrow="Overview"
                title={
                    <span>
                        {hello}
                        {firstName ? (
                            <>
                                ,{' '}
                                <Box as="span" bgImage="var(--chakra-gradients-brand)" bgClip="text" color="transparent">
                                    {firstName}
                                </Box>
                            </>
                        ) : null}
                    </span>
                }
                description="Pick up a conversation where you left off, or start a new one with any of your agents."
                actions={
                    <Button onClick={openNewChat} boxShadow="glow" size="md">
                        <LuMessageSquarePlus /> New chat
                    </Button>
                }
            />

            <SimpleGrid columns={3} gap={{ base: '2', sm: '3' }} mb={{ base: '10', md: '12' }}>
                <StatTile label={spaces.length === 1 ? 'Space' : 'Spaces'} value={spaces.length} icon={<LuBoxes size={20} />} />
                <StatTile label={activeAgents.length === 1 ? 'Agent available' : 'Agents available'} value={activeAgents.length} icon={<LuBot size={20} />} />
                <StatTile label={entries.length === 1 ? 'Conversation' : 'Conversations'} value={entries.length} icon={<LuMessagesSquare size={20} />} />
            </SimpleGrid>

            <Box as="section" mb={{ base: '10', md: '12' }}>
                <SectionTitle title="Continue where you left off" />
                {recent.length === 0 ? (
                    <EmptyState
                        icon={<LuMessagesSquare size={22} />}
                        title="No conversations yet"
                        description="Conversations you start with your agents will show up here."
                        action={
                            <Button onClick={openNewChat} size="sm">
                                Start your first conversation
                            </Button>
                        }
                    />
                ) : (
                    <SimpleGrid columns={{ base: 1, md: 2 }} gap="3">
                        {recent.map(({ chat, agent, space, href }) => (
                            <LinkSurface key={chat.chatId} href={href as string} p="4">
                                <HStack gap="3.5" align="center">
                                    <AgentAvatar name={agent?.displayName} size={40} />
                                    <Box flex="1" minW="0">
                                        <Text fontWeight="600" truncate>
                                            {chat.title || 'New conversation'}
                                        </Text>
                                        <Text fontSize="sm" color="fg.muted" truncate>
                                            {agent?.displayName} · {space?.title}
                                        </Text>
                                    </Box>
                                    <Text fontSize="xs" color="fg.subtle" flexShrink={0} suppressHydrationWarning>
                                        {formatRelative(chat.updatedAt)}
                                    </Text>
                                </HStack>
                            </LinkSurface>
                        ))}
                    </SimpleGrid>
                )}
            </Box>

            <Box as="section">
                <SectionTitle title="Your spaces" hint={`${spaces.length} available`} />
                {spaces.length === 0 ? (
                    <EmptyState icon={<LuBoxes size={22} />} title="No spaces yet" description="You don't have access to any agent spaces yet. Ask your administrator to add you to one." />
                ) : (
                    <Grid templateColumns={{ base: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(3, 1fr)' }} gap="4">
                        {spaces.map(space => {
                            const agents = space.agents.filter(agent => agent.active);
                            const conversations = entries.filter(entry => entry.space?.id === space.id).length;

                            return (
                                <LinkSurface key={space.id} href={spaceHref(space.id)} p="5">
                                    <Flex direction="column" h="full" gap="4">
                                        <HStack gap="3">
                                            <SpaceIcon size={42} />
                                            <Text fontSize="md" fontWeight="600" flex="1" truncate>
                                                {space.title}
                                            </Text>
                                            <Box color="fg.subtle">
                                                <LuArrowRight size={18} />
                                            </Box>
                                        </HStack>
                                        <Text fontSize="sm" color="fg.muted" lineHeight="1.6" flex="1" lineClamp={3}>
                                            {space.description || 'An agent space.'}
                                        </Text>
                                        <HStack justify="space-between" pt="3" borderTopWidth="1px" borderColor="border">
                                            <HStack gap="-1.5">
                                                {agents.slice(0, 4).map(agent => (
                                                    <AgentAvatar key={agent.id} name={agent.displayName} size={26} bg="bg.panel" borderRadius="control" ml="-1.5" _first={{ ml: 0 }} />
                                                ))}
                                            </HStack>
                                            <Text fontSize="xs" color="fg.muted">
                                                {agents.length} {agents.length === 1 ? 'agent' : 'agents'} · {conversations} {conversations === 1 ? 'chat' : 'chats'}
                                            </Text>
                                        </HStack>
                                    </Flex>
                                </LinkSurface>
                            );
                        })}
                    </Grid>
                )}
            </Box>
        </PageContainer>
    );
}
