'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Box, Drawer, Flex, HStack, IconButton, Portal } from '@chakra-ui/react';
import { LuMenu, LuMessageSquarePlus } from 'react-icons/lu';

import { usePersistentState } from '@/hooks/persistent-state';
import { BRAND } from '@/theme/brand.config';
import { Logo } from '../logo';
import { NewChatDialog } from '../new-chat-dialog';
import { AppShellContext } from './context';
import { Sidebar } from './sidebar';

const SIDEBAR_WIDTH = '288px';
const RAIL_WIDTH = '72px';

/** Fine film grain over the canvas — part of the Keen atmosphere. */
const NOISE =
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** The fixed backdrop behind every authenticated page: flat canvas, soft brand bloom, grain. */
export const Atmosphere = () => (
    <Box position="fixed" inset="0" zIndex="0" pointerEvents="none" aria-hidden="true">
        <Box
            position="absolute"
            inset="0"
            bg="bg.canvas"
            backgroundImage="radial-gradient(ellipse 900px 700px at 92% -10%, var(--chakra-colors-brand-subtle), transparent 65%), radial-gradient(ellipse 700px 600px at -10% 110%, var(--chakra-colors-brand-subtle), transparent 60%)"
        />
        <Box position="absolute" inset="0" opacity={{ _dark: 0.05, _light: 0.025 }} mixBlendMode={{ _dark: 'soft-light', _light: 'multiply' }} backgroundImage={NOISE} />
    </Box>
);

/**
 * The authenticated app frame.
 *
 *   desktop  ─ a persistent sidebar (collapsible to an icon rail) + the page
 *   mobile   ─ a slim top bar + the same sidebar in a drawer
 *
 * Chat pages render their own header (with the menu button, via useAppShell), so
 * the mobile top bar is left out there.
 */
export const Component = ({ children }: React.PropsWithChildren) => {
    const params = useParams<{ chatID?: string }>();
    const inChat = Boolean(params.chatID);

    const [collapsed, setCollapsed] = usePersistentState('ui.sidebarCollapsed', false);
    const [navOpen, setNavOpen] = useState(false);
    const [newChatOpen, setNewChatOpen] = useState(false);

    const openNav = useCallback(() => setNavOpen(true), []);
    const closeNav = useCallback(() => setNavOpen(false), []);
    const toggleCollapsed = useCallback(() => setCollapsed(!collapsed), [collapsed, setCollapsed]);
    const openNewChat = useCallback(() => setNewChatOpen(true), []);

    const shell = useMemo<App.AppShell.ContextValue>(() => ({ openNav, collapsed, toggleCollapsed, openNewChat }), [openNav, collapsed, toggleCollapsed, openNewChat]);

    return (
        <AppShellContext.Provider value={shell}>
            <Atmosphere />

            <Flex position="relative" zIndex="1" h="100dvh" w="full" overflow="hidden">
                {/* Desktop sidebar */}
                <Box
                    as="aside"
                    aria-label="Main navigation"
                    display={{ base: 'none', lg: 'block' }}
                    w={collapsed ? RAIL_WIDTH : SIDEBAR_WIDTH}
                    flexShrink={0}
                    h="full"
                    bg="bg.bar"
                    backdropFilter="blur(22px) saturate(155%)"
                    borderRightWidth="1px"
                    borderColor="border"
                    transition="width 0.2s cubic-bezier(.2,.7,.2,1)"
                    overflow="hidden"
                >
                    <Sidebar compact={collapsed} />
                </Box>

                {/* Page column */}
                <Flex direction="column" flex="1" minW="0" h="full">
                    {!inChat && (
                        <HStack
                            display={{ base: 'flex', lg: 'none' }}
                            h="14"
                            px="2"
                            justify="space-between"
                            flexShrink={0}
                            bg="bg.bar"
                            backdropFilter="blur(22px) saturate(155%)"
                            borderBottomWidth="1px"
                            borderColor="border"
                            position="sticky"
                            top="0"
                            zIndex="docked"
                        >
                            <IconButton aria-label="Open menu" variant="ghost" onClick={openNav}>
                                <LuMenu />
                            </IconButton>
                            <Link href="/" aria-label={`${BRAND.name} home`}>
                                <Logo height={22} />
                            </Link>
                            <IconButton aria-label="New chat" variant="ghost" onClick={openNewChat}>
                                <LuMessageSquarePlus />
                            </IconButton>
                        </HStack>
                    )}

                    <Box as="main" id="main" flex="1" minH="0" overflowY={inChat ? 'hidden' : 'auto'} position="relative">
                        {children}
                    </Box>
                </Flex>
            </Flex>

            {/* Mobile navigation drawer */}
            <Drawer.Root open={navOpen} onOpenChange={details => setNavOpen(details.open)} placement="start" size="xs">
                <Portal>
                    <Drawer.Backdrop bg="blackAlpha.600" backdropFilter="blur(3px)" />
                    <Drawer.Positioner>
                        <Drawer.Content
                            bg="bg.chrome"
                            backdropFilter="blur(22px)"
                            maxW="320px"
                            borderRightWidth="1px"
                            borderColor="border"
                            paddingTop="env(safe-area-inset-top)"
                            paddingBottom="env(safe-area-inset-bottom)"
                        >
                            <Sidebar onNavigate={closeNav} onClose={closeNav} />
                        </Drawer.Content>
                    </Drawer.Positioner>
                </Portal>
            </Drawer.Root>

            <NewChatDialog open={newChatOpen} onOpenChange={setNewChatOpen} />
        </AppShellContext.Provider>
    );
};

Component.displayName = 'AppShell';
