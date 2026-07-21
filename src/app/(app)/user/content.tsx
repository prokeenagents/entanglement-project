'use client';

import { useRouter } from 'next/navigation';
import { Button, Container, Separator, Stack, Text } from '@chakra-ui/react';

import { CardShell } from '@/components/ui/card-shell';
import { ProfileForm } from './profile-form';
import { PasswordForm } from './password-form';

/**
 * The consumer's account page — composes the two forms:
 *   1. ProfileForm  — edit name / gender / date of birth (prefilled from `profile`).
 *   2. PasswordForm — change password (two-leg: claim → email → confirm).
 *
 * `profile` is fetched server-side in page.tsx (GET /keen-api/consumer/profile) and
 * threaded into the profile form for prefill.
 */
export function UserContent({ profile }: { profile: Keen.ConsumerProfile | null }) {
    const router = useRouter();

    return (
        <Container maxW="3xl" py={20}>
            <CardShell title="Your account">
                <Stack gap={6}>
                    <Button alignSelf="flex-start" onClick={() => router.push('/')}>
                        <Text as="span">Back</Text>
                    </Button>

                    <ProfileForm profile={profile} />

                    <Separator />

                    <PasswordForm />
                </Stack>
            </CardShell>
        </Container>
    );
}

UserContent.displayName = 'User.Content';
