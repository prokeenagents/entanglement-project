'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Box, Button, Container, Flex, Text } from '@chakra-ui/react';
import { LuBot } from 'react-icons/lu';

import { EmptyState } from '@/components/ui/empty-state';
import { PageContainer } from '@/components/ui/page-header';
import { ChatHeader } from '@/components/ui-chat/chat-header';
import { ChatMessages } from '@/components/ui-chat/chat-messages';
import { ChatPrompt } from '@/components/ui-chat/chat-prompt';
import { ChatShell, useChat } from '@/components/ui-chat/chat-shell';
import { useChatList } from '@/contexts/chat-list';
import { useConsumer } from '@/contexts/consumer';
import { usePersistentState } from '@/hooks/persistent-state';
import { spaceHref } from '@/utils/routes';

/**
 * Re-read the conversation list whenever a turn settles — that's when a brand-new
 * chat first exists server-side (and gets its title), so it appears in the sidebar.
 */
function ChatListSync() {
    const { running } = useChat();
    const { refresh } = useChatList();
    const wasRunning = useRef(false);

    useEffect(() => {
        if (wasRunning.current && !running) {
            void refresh();
        }

        wasRunning.current = running;
    }, [running, refresh]);

    return null;
}

/**
 * A live conversation: header, the transcript (history + streamed turns with
 * their run traces) and the composer, full height with the transcript scrolling
 * between them. `consumerData` comes from the server (the connector + httpOnly
 * cookies only exist there) and feeds the chat connection in ChatShell.
 */
export const Content: React.FC<{
    spaceID: string;
    agentID: string;
    chatID: string;
    consumerData: Keen.ConsumerData;
}> = props => {
    const { spaceID, agentID, chatID, consumerData } = props;

    const consumer = useConsumer();
    const [showSteps, setShowSteps] = usePersistentState('chat.showSteps', false);

    const space = consumer.consumerSpaces.find(s => s.id === spaceID);
    const agent = space?.agents.find(a => a.id === agentID && a.active);

    if (!space || !agent || !agent.agentId) {
        return (
            <PageContainer>
                <EmptyState
                    icon={<LuBot size={22} />}
                    title="This conversation isn't available"
                    description="The agent doesn't exist, is disabled, or you don't have access to its space."
                    action={
                        <Button asChild size="sm">
                            <Link href={space ? spaceHref(space.id) : '/'}>{space ? `Back to ${space.title}` : 'Back to home'}</Link>
                        </Button>
                    }
                />
            </PageContainer>
        );
    }

    return (
        <ChatShell chatID={chatID} agentID={agentID} spaceID={spaceID} consumerData={consumerData}>
            <Flex direction="column" h="full">
                <ChatHeader space={space} agent={agent} showSteps={showSteps} onToggleSteps={() => setShowSteps(!showSteps)} />
                <ChatMessages agentName={agent.displayName} spaceTitle={space.title} showSteps={showSteps} />
                <Box flexShrink={0} pb="max(12px, env(safe-area-inset-bottom))" pt="2">
                    <Container maxW="820px" px={{ base: '3', md: '6' }}>
                        <ChatPrompt agentName={agent.displayName} />
                        <Text fontSize="11px" color="fg.subtle" textAlign="center" mt="2" display={{ base: 'none', sm: 'block' }}>
                            AI agents can make mistakes. Check important information.
                        </Text>
                    </Container>
                </Box>
            </Flex>
            <ChatListSync />
        </ChatShell>
    );
};
