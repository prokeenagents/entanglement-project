'use client';

import { HStack, IconButton, Text, VStack } from '@chakra-ui/react';
import { Logo } from '../logo';
import { useRouter } from 'next/navigation';
import { useConsumer } from '@/contexts/consumer';
import { FaRegUser } from 'react-icons/fa';
import { FiLogOut } from 'react-icons/fi';
import { PiLineVertical } from 'react-icons/pi';
import { Tooltip } from '../tooltip';
import { useLogin } from '@/hooks/login';

export const Component: React.FC = () => {
    const router = useRouter();
    const consumer = useConsumer();
    const loginHook = useLogin();

    return (
        <HStack w="full" h="60px" bg="white" position="fixed" top="0" left="0" shadow="sm" zIndex="docked" px="2" justifyContent="space-between">
            <HStack gap="1" cursor="pointer" onClick={() => router.push('/')}>
                <Logo />
                <VStack gap="0" alignItems="flex-start">
                    <Text fontSize="sm" color="cyan.700" lineHeight="1.2">
                        <strong>Entanglement</strong>
                    </Text>
                    <Text fontSize="xs" color="cyan.700" opacity="0.75" lineHeight="1.2">
                        Project
                    </Text>
                </VStack>
            </HStack>

            <HStack>
                <HStack>
                    <VStack gap="0" alignItems="flex-end">
                        <Text fontSize="sm" lineHeight="1.2">
                            <strong>{consumer.tokenPayload?.username}</strong>
                        </Text>
                        <Text fontSize="xs" opacity="0.75" lineHeight="1.2">
                            {consumer.tokenPayload?.email}
                        </Text>
                    </VStack>
                    <Tooltip content="Account">
                        <IconButton aria-label="Search database" variant="surface" size="xs">
                            <FaRegUser />
                        </IconButton>
                    </Tooltip>
                </HStack>

                <PiLineVertical size="15px" />

                <Tooltip content="Logout">
                    <IconButton aria-label="Search database" variant="surface" size="xs" onClick={async () => await loginHook.logout()}>
                        <FiLogOut />
                    </IconButton>
                </Tooltip>
            </HStack>
        </HStack>
    );
};

Component.displayName = 'Header';
