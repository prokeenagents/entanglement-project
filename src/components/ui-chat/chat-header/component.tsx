'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Box, HStack, IconButton, Input, Menu, Portal, Text } from '@chakra-ui/react';
import { LuEllipsisVertical, LuHistory, LuListTree, LuMenu, LuMessageSquarePlus, LuPencil, LuTrash2 } from 'react-icons/lu';

import { AgentAvatar } from '@/components/ui/agent-avatar';
import { useAppShell } from '@/components/ui/app-shell';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toaster } from '@/components/ui/toaster';
import { Tooltip } from '@/components/ui/tooltip';
import { useChatList } from '@/contexts/chat-list';
import { agentHref, newChatHref } from '@/utils/routes';
import { useChat } from '../chat-shell';

type ChatHeaderProps = {
    space: Keen.SpaceListCacheResult;
    agent: Keen.SpaceListCacheAgent;
    showSteps: boolean;
    onToggleSteps: () => void;
};

const STATUS_TEXT: Record<App.Chat.ConnectStatus, string> = {
    connected: 'Online',
    connecting: 'Connecting…',
    disconnected: 'Offline',
    unauthorized: 'Session expired'
};

/**
 * The conversation bar: who you're talking to (with live connection status), the
 * conversation title (rename inline), and the actions — steps on/off, new chat,
 * rename, delete. On mobile it also carries the navigation button.
 */
export const Component = ({ space, agent, showSteps, onToggleSteps }: ChatHeaderProps) => {
    const router = useRouter();
    const { openNav } = useAppShell();
    const { chatID, status } = useChat();
    const { entries, rename, remove } = useChatList();

    const entry = entries.find(item => item.chat.chatId === chatID);
    const title = entry?.chat.title || 'New conversation';

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(title);
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const commit = async () => {
        setEditing(false);

        if (!draft.trim() || draft.trim() === title) {
            return;
        }

        const result = await rename(chatID, draft);

        if (!result.ok) {
            toaster.create({ type: 'error', title: result.message });
        }
    };

    const confirmDelete = async () => {
        setDeleting(true);
        const result = await remove(chatID);
        setDeleting(false);
        setConfirming(false);

        if (result.ok) {
            router.push(agentHref(space.id, agent.id));
        } else {
            toaster.create({ type: 'error', title: result.message });
        }
    };

    return (
        <HStack
            as="header"
            h={{ base: '14', md: '16' }}
            px={{ base: '2', md: '5' }}
            gap={{ base: '1.5', md: '3' }}
            flexShrink={0}
            bg="bg.bar"
            backdropFilter="blur(22px) saturate(155%)"
            borderBottomWidth="1px"
            borderColor="border"
            position="relative"
            zIndex="docked"
        >
            <IconButton aria-label="Open menu" variant="ghost" display={{ base: 'inline-flex', lg: 'none' }} onClick={openNav}>
                <LuMenu />
            </IconButton>

            <Link href={agentHref(space.id, agent.id)} aria-label={`${agent.displayName} — all conversations`}>
                <AgentAvatar name={agent.displayName} size={34} online={status === 'connected'} />
            </Link>

            <Box flex="1" minW="0">
                {editing ? (
                    <Input
                        size="sm"
                        autoFocus
                        value={draft}
                        aria-label="Conversation title"
                        maxW="420px"
                        onChange={event => setDraft(event.target.value)}
                        onBlur={() => void commit()}
                        onKeyDown={event => {
                            if (event.key === 'Enter') {
                                event.preventDefault();
                                void commit();
                            }

                            if (event.key === 'Escape') {
                                setEditing(false);
                            }
                        }}
                    />
                ) : (
                    <>
                        <Text
                            fontSize={{ base: 'sm', md: 'md' }}
                            fontWeight="600"
                            truncate
                            cursor={entry ? 'text' : 'default'}
                            title={entry ? 'Double-click to rename' : undefined}
                            onDoubleClick={() => {
                                if (entry) {
                                    setDraft(title);
                                    setEditing(true);
                                }
                            }}
                        >
                            {title}
                        </Text>
                        <Text fontSize="xs" color="fg.muted" truncate>
                            {agent.displayName} · {space.title} ·{' '}
                            <Box as="span" color={status === 'connected' ? 'green.500' : status === 'unauthorized' ? 'red.500' : 'fg.muted'}>
                                {STATUS_TEXT[status]}
                            </Box>
                        </Text>
                    </>
                )}
            </Box>

            <Tooltip content={showSteps ? 'Hide agent steps' : 'Show agent steps'}>
                <IconButton
                    aria-label={showSteps ? 'Hide agent steps' : 'Show agent steps'}
                    aria-pressed={showSteps}
                    variant={showSteps ? 'subtle' : 'ghost'}
                    colorPalette={showSteps ? 'brand' : 'gray'}
                    color={showSteps ? 'brand.fg' : 'fg.muted'}
                    onClick={onToggleSteps}
                >
                    <LuListTree />
                </IconButton>
            </Tooltip>

            <Tooltip content="New chat">
                <IconButton aria-label="New chat" variant="ghost" color="fg.muted" onClick={() => router.push(newChatHref(space.id, agent.id))}>
                    <LuMessageSquarePlus />
                </IconButton>
            </Tooltip>

            <Menu.Root positioning={{ placement: 'bottom-end' }}>
                <Menu.Trigger asChild>
                    <IconButton aria-label="Conversation options" variant="ghost" color="fg.muted">
                        <LuEllipsisVertical />
                    </IconButton>
                </Menu.Trigger>
                <Portal>
                    <Menu.Positioner>
                        <Menu.Content minW="200px">
                            <Menu.Item value="history" onSelect={() => router.push(agentHref(space.id, agent.id))}>
                                <LuHistory /> All conversations
                            </Menu.Item>
                            <Menu.Item
                                value="rename"
                                disabled={!entry}
                                onSelect={() => {
                                    setDraft(title);
                                    setEditing(true);
                                }}
                            >
                                <LuPencil /> Rename
                            </Menu.Item>
                            <Menu.Separator />
                            <Menu.Item value="delete" disabled={!entry} color="fg.error" _hover={{ bg: 'bg.error', color: 'fg.error' }} onSelect={() => setConfirming(true)}>
                                <LuTrash2 /> Delete conversation
                            </Menu.Item>
                        </Menu.Content>
                    </Menu.Positioner>
                </Portal>
            </Menu.Root>

            <ConfirmDialog
                open={confirming}
                onOpenChange={setConfirming}
                title="Delete this conversation?"
                description={
                    <>
                        <strong>{title}</strong> will be removed from your conversations. This can&apos;t be undone.
                    </>
                }
                confirmLabel="Delete"
                destructive
                loading={deleting}
                onConfirm={() => void confirmDelete()}
            />
        </HStack>
    );
};

Component.displayName = 'ChatHeader';
