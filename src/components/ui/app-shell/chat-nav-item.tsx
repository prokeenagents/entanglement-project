'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Box, HStack, IconButton, Input, Menu, Portal, Text } from '@chakra-ui/react';
import { LuEllipsis, LuPencil, LuTrash2 } from 'react-icons/lu';

import { useChatList } from '@/contexts/chat-list';
import { formatRelative } from '@/utils/time';
import { ConfirmDialog } from '../confirm-dialog';
import { toaster } from '../toaster';

type ChatNavItemProps = {
    entry: App.ChatList.Entry;
    active: boolean;
    /** Called after navigating — closes the mobile drawer. */
    onNavigate?: () => void;
    /** Show which agent the chat is with (off when the list is already per-agent). */
    showAgent?: boolean;
    /** Show "updated 3h ago" on the right (roomier lists, e.g. the agent page). */
    showTime?: boolean;
    /** Larger touch target + text for full-page lists. */
    size?: 'sm' | 'md';
};

export const untitled = 'New conversation';

/**
 * One conversation in a list: link + an overflow menu (rename inline, delete with
 * confirmation). Shared by the sidebar and the agent page.
 */
export const ChatNavItem = ({ entry, active, onNavigate, showAgent = true, showTime = false, size = 'sm' }: ChatNavItemProps) => {
    const { rename, remove } = useChatList();
    const { chat, agent, href } = entry;
    const title = chat.title || untitled;

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(title);
    const [confirming, setConfirming] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const commit = async () => {
        setEditing(false);

        if (draft.trim() === title || !draft.trim()) {
            setDraft(title);
            return;
        }

        const result = await rename(chat.chatId, draft);

        if (!result.ok) {
            setDraft(title);
            toaster.create({ type: 'error', title: result.message });
        }
    };

    const confirmDelete = async () => {
        setDeleting(true);
        const result = await remove(chat.chatId);
        setDeleting(false);
        setConfirming(false);

        if (!result.ok) {
            toaster.create({ type: 'error', title: result.message });
        }
    };

    if (editing) {
        return (
            <Box px="1" py="0.5">
                <Input
                    size="sm"
                    autoFocus
                    value={draft}
                    aria-label="Conversation title"
                    onChange={event => setDraft(event.target.value)}
                    onBlur={() => void commit()}
                    onKeyDown={event => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            void commit();
                        }

                        if (event.key === 'Escape') {
                            setDraft(title);
                            setEditing(false);
                        }
                    }}
                />
            </Box>
        );
    }

    const body = (
        <HStack flex="1" minW="0" py={size === 'md' ? '3.5' : '2'} pl={size === 'md' ? '4' : '3'} gap="3">
            <Box flex="1" minW="0">
                <Text fontSize={size === 'md' ? 'md' : 'sm'} fontWeight={active ? '600' : '500'} color={active ? 'fg' : chat.title ? 'fg' : 'fg.muted'} truncate>
                    {title}
                </Text>
                {showAgent && agent && (
                    <Text fontSize="xs" color="fg.subtle" truncate>
                        {agent.displayName}
                    </Text>
                )}
            </Box>
            {showTime && (
                <Text fontSize="xs" color="fg.subtle" flexShrink={0} suppressHydrationWarning>
                    {formatRelative(chat.updatedAt)}
                </Text>
            )}
        </HStack>
    );

    return (
        <>
            <HStack
                gap="0"
                position="relative"
                borderRadius="control"
                bg={active ? 'brand.subtle' : 'transparent'}
                transition="background 0.15s ease"
                _hover={{ bg: active ? 'brand.subtle' : 'bg.muted', '& .item-menu': { opacity: 1 } }}
                _focusWithin={{ '& .item-menu': { opacity: 1 } }}
                opacity={href ? 1 : 0.6}
            >
                {active && <Box position="absolute" left="0" top="2" bottom="2" w="3px" borderRadius="full" bg="brand.solid" boxShadow="0 0 8px var(--chakra-colors-brand-500)" />}
                {href ? (
                    <Link href={href} onClick={onNavigate} style={{ flex: 1, minWidth: 0 }} aria-current={active ? 'page' : undefined}>
                        {body}
                    </Link>
                ) : (
                    body
                )}
                <Menu.Root positioning={{ placement: 'bottom-end' }}>
                    <Menu.Trigger asChild>
                        <IconButton className="item-menu" aria-label={`Options for ${title}`} variant="ghost" size="xs" mr="1" color="fg.muted" opacity={{ base: 1, lg: active ? 1 : 0 }}>
                            <LuEllipsis />
                        </IconButton>
                    </Menu.Trigger>
                    <Portal>
                        <Menu.Positioner>
                            <Menu.Content minW="160px">
                                <Menu.Item
                                    value="rename"
                                    onSelect={() => {
                                        // Seed from the LIVE title — it may have changed since mount (auto-title, rename elsewhere).
                                        setDraft(title);
                                        setEditing(true);
                                    }}
                                >
                                    <LuPencil /> Rename
                                </Menu.Item>
                                <Menu.Item value="delete" color="fg.error" _hover={{ bg: 'bg.error', color: 'fg.error' }} onSelect={() => setConfirming(true)}>
                                    <LuTrash2 /> Delete
                                </Menu.Item>
                            </Menu.Content>
                        </Menu.Positioner>
                    </Portal>
                </Menu.Root>
            </HStack>
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
        </>
    );
};
