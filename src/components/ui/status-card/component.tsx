'use client';

import Link from 'next/link';
import { Button, Center, Stack, Text } from '@chakra-ui/react';
import { LuCompass, LuMailCheck, LuTriangleAlert, LuWrench } from 'react-icons/lu';

import { CardShell } from '../card-shell';

const ICONS = {
    error: <LuTriangleAlert size={24} />,
    mail: <LuMailCheck size={24} />,
    maintenance: <LuWrench size={24} />,
    lost: <LuCompass size={24} />
} as const;

type StatusCardProps = {
    tone: keyof typeof ICONS;
    title: string;
    message: string;
    actionLabel?: string;
    /** Navigate here on click… */
    actionHref?: string;
    /** …or reload the page instead (maintenance "try again"). */
    reload?: boolean;
};

/**
 * A one-message screen in the auth card: an icon, what happened, one way forward.
 * Props are plain strings so SERVER components (e.g. the email-link landings)
 * can render it directly.
 */
export const Component = ({ tone, title, message, actionLabel, actionHref, reload }: StatusCardProps) => (
    <CardShell width={420}>
        <Stack align="center" textAlign="center" gap="3" py="2">
            <Center
                w="14"
                h="14"
                borderRadius="card"
                bg={tone === 'error' ? 'bg.error' : 'brand.subtle'}
                color={tone === 'error' ? 'fg.error' : 'brand.fg'}
                borderWidth="1px"
                borderColor={tone === 'error' ? 'border.error' : 'brand.border'}
                mb="2"
            >
                {ICONS[tone]}
            </Center>
            <Text as="h1" fontSize="xl" fontWeight="700" letterSpacing="-0.02em">
                {title}
            </Text>
            <Text color="fg.muted" fontSize="sm" lineHeight="1.6">
                {message}
            </Text>
            {actionLabel && (actionHref || reload) && (
                <Stack w="full" pt="4">
                    {reload ? (
                        <Button w="full" onClick={() => window.location.reload()}>
                            {actionLabel}
                        </Button>
                    ) : (
                        <Button w="full" asChild>
                            <Link href={actionHref as string}>{actionLabel}</Link>
                        </Button>
                    )}
                </Stack>
            )}
        </Stack>
    </CardShell>
);

Component.displayName = 'StatusCard';
