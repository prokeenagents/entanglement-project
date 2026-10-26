'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Box, Button, Flex, HStack, IconButton, Input, InputGroup, Menu, Portal, Separator, Stack, Text } from '@chakra-ui/react';
import { LuChevronsUpDown, LuHouse, LuMessageSquarePlus, LuPanelLeftClose, LuPanelLeftOpen, LuSearch, LuX } from 'react-icons/lu';

import { useChatList } from '@/contexts/chat-list';
import { useConsumer } from '@/contexts/consumer';
import { usePersistentState } from '@/hooks/persistent-state';
import { BRAND } from '@/theme/brand.config';
import { groupByRecency } from '@/utils/time';
import { agentHref, newChatHref, spaceHref } from '@/utils/routes';
import { AgentAvatar, SpaceIcon } from '../agent-avatar';
import { Logo } from '../logo';
import { Tooltip } from '../tooltip';
import { ChatNavItem } from './chat-nav-item';
import { useAppShell } from './context';
import { UserMenu } from './user-menu';

type RouteParams = { id?: string; agentID?: string; chatID?: string };

type SidebarProps = {
    /** Icon-only rail (desktop collapsed). */
    compact?: boolean;
    /** Close the mobile drawer after a navigation. */
    onNavigate?: () => void;
    /** Mobile drawer: show a close button instead of the collapse toggle. */
    onClose?: () => void;
};

const SectionLabel = ({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) => (
    <HStack justify="space-between" px="3" pt="5" pb="1.5">
        <Text fontSize="11px" fontWeight="600" textTransform="uppercase" letterSpacing="0.14em" color="fg.subtle">
            {children}
        </Text>
        {action}
    </HStack>
);

const NavRow = ({ href, active, icon, label, compact, onNavigate }: { href: string; active: boolean; icon: React.ReactNode; label: string; compact?: boolean; onNavigate?: () => void }) => {
    const row = (
        <Link href={href} onClick={onNavigate} aria-current={active ? 'page' : undefined} aria-label={compact ? label : undefined}>
            <HStack
                gap="3"
                h="10"
                px={compact ? '0' : '3'}
                justify={compact ? 'center' : 'flex-start'}
                borderRadius="control"
                position="relative"
                color={active ? 'fg' : 'fg.muted'}
                bg={active ? 'brand.subtle' : 'transparent'}
                fontWeight={active ? '600' : '500'}
                fontSize="sm"
                transition="all 0.15s ease"
                _hover={{ bg: active ? 'brand.subtle' : 'bg.muted', color: 'fg' }}
            >
                {active && (
                    <Box position="absolute" left={compact ? '-2' : '0'} top="2.5" bottom="2.5" w="3px" borderRadius="full" bg="brand.solid" boxShadow="0 0 8px var(--chakra-colors-brand-500)" />
                )}
                {icon}
                {!compact && <Text truncate>{label}</Text>}
            </HStack>
        </Link>
    );

    return compact ? (
        <Tooltip content={label} positioning={{ placement: 'right' }}>
            {row}
        </Tooltip>
    ) : (
        row
    );
};

/**
 * The app's navigation: new chat, the space switcher + its agents, and every
 * conversation grouped by recency. Rendered in the desktop sidebar (expanded or
 * as an icon rail) and inside the mobile drawer.
 */
export const Sidebar = ({ compact, onNavigate, onClose }: SidebarProps) => {
    const router = useRouter();
    const pathname = usePathname();
    const params = useParams<RouteParams>();
    const consumer = useConsumer();
    const { entries } = useChatList();
    const { collapsed, toggleCollapsed, openNewChat } = useAppShell();

    const spaces = consumer.consumerSpaces;
    const [lastSpaceId, setLastSpaceId] = usePersistentState<string | null>('ui.lastSpace', null);
    const [query, setQuery] = useState('');

    // Remember the space you were last in, so the switcher keeps it outside /space.
    useEffect(() => {
        if (params.id && params.id !== lastSpaceId) {
            setLastSpaceId(params.id);
        }
    }, [params.id, lastSpaceId, setLastSpaceId]);

    const currentSpace = spaces.find(space => space.id === (params.id ?? lastSpaceId)) ?? spaces[0] ?? null;
    const agents = currentSpace ? currentSpace.agents.filter(agent => agent.active) : [];

    const groups = useMemo(() => {
        const needle = query.trim().toLowerCase();
        const visible = needle ? entries.filter(entry => (entry.chat.title ?? '').toLowerCase().includes(needle) || (entry.agent?.displayName ?? '').toLowerCase().includes(needle)) : entries;

        return groupByRecency(visible, entry => entry.chat.updatedAt);
    }, [entries, query]);

    // In a conversation, "New chat" means "another one with this agent".
    const newChat = () => {
        onNavigate?.();

        if (params.id && params.agentID) {
            router.push(newChatHref(params.id, params.agentID));
            return;
        }

        openNewChat();
    };

    const header = (
        <HStack h="16" px={compact ? '0' : '4'} justify={compact ? 'center' : 'space-between'} flexShrink={0}>
            {compact ? (
                <Tooltip content="Expand sidebar" positioning={{ placement: 'right' }}>
                    <IconButton aria-label="Expand sidebar" variant="ghost" size="sm" onClick={toggleCollapsed} color="fg.muted">
                        <LuPanelLeftOpen />
                    </IconButton>
                </Tooltip>
            ) : (
                <>
                    <Link href="/" onClick={onNavigate} aria-label={`${BRAND.name} home`}>
                        <Logo height={26} />
                    </Link>
                    {onClose ? (
                        <IconButton aria-label="Close menu" variant="ghost" size="sm" onClick={onClose} color="fg.muted">
                            <LuX />
                        </IconButton>
                    ) : (
                        <Tooltip content={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
                            <IconButton aria-label="Collapse sidebar" variant="ghost" size="sm" onClick={toggleCollapsed} color="fg.muted">
                                <LuPanelLeftClose />
                            </IconButton>
                        </Tooltip>
                    )}
                </>
            )}
        </HStack>
    );

    if (compact) {
        return (
            <Flex direction="column" h="full" align="center" gap="1.5" pb="3">
                {header}
                <Tooltip content="New chat" positioning={{ placement: 'right' }}>
                    <IconButton aria-label="New chat" size="md" onClick={newChat} boxShadow="glow">
                        <LuMessageSquarePlus />
                    </IconButton>
                </Tooltip>
                <Box h="2" />
                <NavRow href="/" active={pathname === '/'} icon={<LuHouse size={19} />} label="Home" compact onNavigate={onNavigate} />
                <Separator w="8" my="2" />
                <Stack gap="1.5" flex="1" overflowY="auto" align="center" py="1">
                    {agents.map(agent => {
                        const active = params.agentID === agent.id;

                        return (
                            <Tooltip key={agent.id} content={agent.displayName} positioning={{ placement: 'right' }}>
                                <Link href={agentHref(agent.spaceId, agent.id)} aria-label={agent.displayName} aria-current={active ? 'page' : undefined}>
                                    <AgentAvatar name={agent.displayName} size={36} outline={active ? '2px solid' : undefined} outlineColor="brand.solid" outlineOffset="2px" borderRadius="control" />
                                </Link>
                            </Tooltip>
                        );
                    })}
                </Stack>
                <UserMenu compact onNavigate={onNavigate} />
            </Flex>
        );
    }

    return (
        <Flex direction="column" h="full" minH="0">
            {header}

            <Stack px="3" gap="2.5" flexShrink={0}>
                <Button onClick={newChat} w="full" justifyContent="flex-start" gap="2.5" boxShadow="glow" size="md">
                    <LuMessageSquarePlus /> New chat
                </Button>
                <NavRow href="/" active={pathname === '/'} icon={<LuHouse size={18} />} label="Home" onNavigate={onNavigate} />
            </Stack>

            <Box flex="1" minH="0" overflowY="auto" px="3" pb="4" mt="1">
                {currentSpace && (
                    <>
                        <SectionLabel>Space</SectionLabel>
                        <Menu.Root positioning={{ placement: 'bottom-start', sameWidth: true }}>
                            <Menu.Trigger asChild>
                                <HStack
                                    as="button"
                                    w="full"
                                    gap="3"
                                    p="2"
                                    borderRadius="control"
                                    borderWidth="1px"
                                    borderColor="border"
                                    bg="bg.glass"
                                    cursor="pointer"
                                    textAlign="left"
                                    transition="all 0.15s ease"
                                    _hover={{ borderColor: 'brand.border', bg: 'bg.glassHover' }}
                                    aria-label="Switch space"
                                >
                                    <SpaceIcon size={32} />
                                    <Box flex="1" minW="0">
                                        <Text fontSize="sm" fontWeight="600" truncate>
                                            {currentSpace.title}
                                        </Text>
                                        <Text fontSize="xs" color="fg.muted">
                                            {agents.length} {agents.length === 1 ? 'agent' : 'agents'}
                                        </Text>
                                    </Box>
                                    <Box color="fg.subtle">
                                        <LuChevronsUpDown size={16} />
                                    </Box>
                                </HStack>
                            </Menu.Trigger>
                            <Portal>
                                <Menu.Positioner>
                                    <Menu.Content>
                                        <Menu.ItemGroup>
                                            <Menu.ItemGroupLabel color="fg.subtle" fontSize="xs">
                                                Your spaces
                                            </Menu.ItemGroupLabel>
                                            {spaces.map(space => (
                                                <Menu.Item
                                                    key={space.id}
                                                    value={space.id}
                                                    onSelect={() => {
                                                        setLastSpaceId(space.id);
                                                        onNavigate?.();
                                                        router.push(spaceHref(space.id));
                                                    }}
                                                >
                                                    <SpaceIcon size={24} />
                                                    <Text flex="1" truncate fontWeight={space.id === currentSpace.id ? '600' : '500'}>
                                                        {space.title}
                                                    </Text>
                                                </Menu.Item>
                                            ))}
                                        </Menu.ItemGroup>
                                    </Menu.Content>
                                </Menu.Positioner>
                            </Portal>
                        </Menu.Root>

                        <SectionLabel
                            action={
                                <Link href={spaceHref(currentSpace.id)} onClick={onNavigate}>
                                    <Text fontSize="xs" color="fg.muted" _hover={{ color: 'brand.fg' }}>
                                        View all
                                    </Text>
                                </Link>
                            }
                        >
                            Agents
                        </SectionLabel>
                        <Stack gap="0.5">
                            {agents.length === 0 && (
                                <Text px="3" py="2" fontSize="sm" color="fg.muted">
                                    No agents available in this space.
                                </Text>
                            )}
                            {agents.map(agent => (
                                <NavRow
                                    key={agent.id}
                                    href={agentHref(agent.spaceId, agent.id)}
                                    active={params.agentID === agent.id && !params.chatID}
                                    icon={<AgentAvatar name={agent.displayName} size={24} />}
                                    label={agent.displayName}
                                    onNavigate={onNavigate}
                                />
                            ))}
                        </Stack>
                    </>
                )}

                <SectionLabel>Conversations</SectionLabel>
                <InputGroup startElement={<LuSearch size={14} />} mb="1">
                    <Input size="sm" placeholder="Search conversations" value={query} onChange={event => setQuery(event.target.value)} aria-label="Search conversations" bg="bg.glass" />
                </InputGroup>

                {groups.length === 0 && (
                    <Text px="3" py="3" fontSize="sm" color="fg.muted">
                        {query ? 'No conversations match.' : 'No conversations yet. Start one with an agent.'}
                    </Text>
                )}

                {groups.map(group => (
                    <Box key={group.label}>
                        <Text px="3" pt="3" pb="1" fontSize="xs" fontWeight="500" color="fg.subtle">
                            {group.label}
                        </Text>
                        <Stack gap="0.5">
                            {group.items.map(entry => (
                                <ChatNavItem key={entry.chat.chatId} entry={entry} active={params.chatID === entry.chat.chatId} onNavigate={onNavigate} />
                            ))}
                        </Stack>
                    </Box>
                ))}
            </Box>

            <Box px="3" py="3" borderTopWidth="1px" borderColor="border" flexShrink={0}>
                <UserMenu onNavigate={onNavigate} />
                {BRAND.poweredBy && (
                    <Text fontSize="11px" color="fg.subtle" textAlign="center" mt="2">
                        {BRAND.poweredBy}
                    </Text>
                )}
            </Box>
        </Flex>
    );
};
