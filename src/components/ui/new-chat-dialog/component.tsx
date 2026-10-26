'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Box, CloseButton, Dialog, HStack, Input, InputGroup, Portal, Stack, Text } from '@chakra-ui/react';
import { LuArrowRight, LuSearch } from 'react-icons/lu';

import { useConsumer } from '@/contexts/consumer';
import { newChatHref } from '@/utils/routes';
import { AgentAvatar } from '../agent-avatar';

type NewChatDialogProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

/**
 * "Who do you want to talk to?" — every available agent, grouped by space, with
 * a filter. Picking one opens a fresh conversation with it.
 */
export const Component = ({ open, onOpenChange }: NewChatDialogProps) => {
    const router = useRouter();
    const consumer = useConsumer();
    const [query, setQuery] = useState('');

    const groups = useMemo(() => {
        const needle = query.trim().toLowerCase();

        return consumer.consumerSpaces
            .map(space => ({
                space,
                agents: space.agents.filter(agent => agent.active && (!needle || agent.displayName.toLowerCase().includes(needle) || space.title.toLowerCase().includes(needle)))
            }))
            .filter(group => group.agents.length > 0);
    }, [consumer.consumerSpaces, query]);

    const start = (spaceId: string, agentId: string) => {
        onOpenChange(false);
        setQuery('');
        router.push(newChatHref(spaceId, agentId));
    };

    return (
        <Dialog.Root open={open} onOpenChange={details => onOpenChange(details.open)} placement="center" motionPreset="slide-in-bottom" scrollBehavior="inside">
            <Portal>
                <Dialog.Backdrop bg="blackAlpha.600" backdropFilter="blur(4px)" />
                <Dialog.Positioner px="4">
                    <Dialog.Content bg="bg.panel" borderWidth="1px" borderColor="border" borderRadius="panel" boxShadow="pop" maxW="520px" maxH="min(640px, 85dvh)">
                        <Dialog.Header flexDirection="column" alignItems="stretch" gap="3" pb="3">
                            <Dialog.Title fontSize="lg" fontWeight="700" letterSpacing="-0.01em">
                                Start a new conversation
                            </Dialog.Title>
                            <InputGroup startElement={<LuSearch />}>
                                <Input placeholder="Search agents or spaces" value={query} onChange={event => setQuery(event.target.value)} autoFocus />
                            </InputGroup>
                        </Dialog.Header>
                        <Dialog.Body pb="5">
                            {groups.length === 0 && (
                                <Text color="fg.muted" fontSize="sm" textAlign="center" py="8">
                                    No agents match “{query}”.
                                </Text>
                            )}
                            <Stack gap="5">
                                {groups.map(({ space, agents }) => (
                                    <Box key={space.id}>
                                        <Text fontSize="xs" fontWeight="600" textTransform="uppercase" letterSpacing="0.12em" color="fg.subtle" mb="2">
                                            {space.title}
                                        </Text>
                                        <Stack gap="1">
                                            {agents.map(agent => (
                                                <HStack
                                                    key={agent.id}
                                                    as="button"
                                                    gap="3"
                                                    px="3"
                                                    py="2.5"
                                                    borderRadius="control"
                                                    textAlign="left"
                                                    cursor="pointer"
                                                    transition="background 0.15s ease"
                                                    _hover={{ bg: 'bg.muted', '& .arrow': { opacity: 1, transform: 'translateX(0)' } }}
                                                    _focusVisible={{ outline: '2px solid', outlineColor: 'brand.500', outlineOffset: '1px' }}
                                                    onClick={() => start(space.id, agent.id)}
                                                >
                                                    <AgentAvatar name={agent.displayName} size={34} />
                                                    <Box flex="1" minW="0">
                                                        <Text fontWeight="600" fontSize="sm" truncate>
                                                            {agent.displayName}
                                                        </Text>
                                                        <Text fontSize="xs" color="fg.muted" truncate>
                                                            {space.title}
                                                        </Text>
                                                    </Box>
                                                    <Box className="arrow" color="brand.fg" opacity="0" transform="translateX(-4px)" transition="all 0.15s ease">
                                                        <LuArrowRight />
                                                    </Box>
                                                </HStack>
                                            ))}
                                        </Stack>
                                    </Box>
                                ))}
                            </Stack>
                        </Dialog.Body>
                        <Dialog.CloseTrigger asChild>
                            <CloseButton size="sm" />
                        </Dialog.CloseTrigger>
                    </Dialog.Content>
                </Dialog.Positioner>
            </Portal>
        </Dialog.Root>
    );
};

Component.displayName = 'NewChatDialog';
