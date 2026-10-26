'use client';

import { Box, Grid, Stack, Text } from '@chakra-ui/react';

import { UserAvatar } from '@/components/ui/agent-avatar';
import { PageContainer, PageHeader } from '@/components/ui/page-header';
import { Surface } from '@/components/ui/surface';
import { useAuth } from '@/contexts/auth';
import { PasswordForm } from './password-form';
import { ProfileForm } from './profile-form';

/** A settings section: what it is on the left, the form in a card on the right. */
const Section = ({ title, description, children }: React.PropsWithChildren<{ title: string; description: string }>) => (
    <Grid templateColumns={{ base: '1fr', lg: '280px 1fr' }} gap={{ base: '4', lg: '10' }} py={{ base: '6', md: '8' }} borderTopWidth="1px" borderColor="border">
        <Box>
            <Text fontSize="md" fontWeight="600">
                {title}
            </Text>
            <Text fontSize="sm" color="fg.muted" mt="1" lineHeight="1.6">
                {description}
            </Text>
        </Box>
        <Surface p={{ base: '5', md: '7' }}>{children}</Surface>
    </Grid>
);

/**
 * The consumer's account page — composes the two forms:
 *   1. ProfileForm  — edit name / gender / date of birth (prefilled from `profile`).
 *   2. PasswordForm — change password (two-leg: claim → email → confirm).
 *
 * `profile` is fetched server-side in page.tsx (GET /keen-api/consumer/profile) and
 * threaded into the profile form for prefill.
 */
export function UserContent({ profile }: { profile: Keen.ConsumerProfile | null }) {
    const { identity } = useAuth();

    return (
        <PageContainer maxW="5xl">
            <PageHeader
                breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Account' }]}
                media={<UserAvatar name={identity?.username} size={56} />}
                eyebrow="Account"
                title={identity?.username || 'Your account'}
                description={identity?.email}
            />

            <Stack gap="0">
                <Section title="Profile" description="Your name and personal details. Your email is your sign-in identity and can't be changed here.">
                    <ProfileForm profile={profile} />
                </Section>
                <Section title="Password" description="Choose a new password. We'll email you a link to confirm the change — nothing changes until you follow it.">
                    <PasswordForm />
                </Section>
            </Stack>
        </PageContainer>
    );
}

UserContent.displayName = 'User.Content';
