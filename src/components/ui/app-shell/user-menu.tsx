'use client';

import { useRouter } from 'next/navigation';
import { Box, HStack, Menu, Portal, Text } from '@chakra-ui/react';
import { LuChevronsUpDown, LuLogOut, LuMoon, LuSun, LuUserRound } from 'react-icons/lu';

import { useAuth } from '@/contexts/auth';
import { useLogin } from '@/hooks/login';
import { UserAvatar } from '../agent-avatar';
import { useColorMode } from '../color-mode-toggle';

/** The signed-in person + account actions, pinned to the bottom of the sidebar. */
export const UserMenu = ({ compact, onNavigate }: { compact?: boolean; onNavigate?: () => void }) => {
    const router = useRouter();
    const { identity } = useAuth();
    const { logout } = useLogin();
    const { colorMode, toggle } = useColorMode();

    const name = identity?.username || 'Account';

    return (
        <Menu.Root positioning={{ placement: compact ? 'right-end' : 'top', sameWidth: !compact }}>
            <Menu.Trigger asChild>
                <HStack
                    as="button"
                    w="full"
                    gap="3"
                    p={compact ? '1' : '2'}
                    justify={compact ? 'center' : 'flex-start'}
                    borderRadius="control"
                    cursor="pointer"
                    textAlign="left"
                    transition="background 0.15s ease"
                    _hover={{ bg: 'bg.muted' }}
                    _expanded={{ bg: 'bg.muted' }}
                    aria-label="Account menu"
                >
                    <UserAvatar name={name} size={compact ? 34 : 36} />
                    {!compact && (
                        <>
                            <Box flex="1" minW="0">
                                <Text fontSize="sm" fontWeight="600" truncate>
                                    {name}
                                </Text>
                                <Text fontSize="xs" color="fg.muted" truncate>
                                    {identity?.email}
                                </Text>
                            </Box>
                            <Box color="fg.subtle">
                                <LuChevronsUpDown size={16} />
                            </Box>
                        </>
                    )}
                </HStack>
            </Menu.Trigger>
            <Portal>
                <Menu.Positioner>
                    <Menu.Content minW="220px">
                        <Menu.Item
                            value="account"
                            onSelect={() => {
                                onNavigate?.();
                                router.push('/user');
                            }}
                        >
                            <LuUserRound /> Account settings
                        </Menu.Item>
                        <Menu.Item value="theme" onSelect={toggle} closeOnSelect={false}>
                            {colorMode === 'light' ? <LuMoon /> : <LuSun />}
                            {colorMode === 'light' ? 'Dark mode' : 'Light mode'}
                        </Menu.Item>
                        <Menu.Separator />
                        <Menu.Item value="logout" color="fg.error" _hover={{ bg: 'bg.error', color: 'fg.error' }} onSelect={() => void logout()}>
                            <LuLogOut /> Log out
                        </Menu.Item>
                    </Menu.Content>
                </Menu.Positioner>
            </Portal>
        </Menu.Root>
    );
};
