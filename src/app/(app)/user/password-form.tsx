'use client';

import * as React from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';

import { generatePasswordHookFormPayload } from '@/@schema/account-password';
import { AUTH_API_CONFIG } from '@/configs/api.config';
import { Alert, Button, Field, Heading, Input, Spinner, Stack, Text } from '@chakra-ui/react';

/**
 * The "change password" form — the SECOND form on the /user account page.
 *
 * A logged-in password change is a two-leg flow: this posts the new password to
 * /api/consumer/reset-password (the two-token CLAIM → Keen emails a confirm link),
 * and it only applies when the consumer follows that link (/confirm-password/<hash>).
 * So a success here means "check your email", never "your password changed". The
 * current password isn't asked for — the live session is the proof of identity.
 */
export function PasswordForm() {
    const form = useForm<App.User.PasswordForm>(generatePasswordHookFormPayload());
    const { register, formState, handleSubmit } = form;
    const { errors, isSubmitting } = formState;

    const [sent, setSent] = React.useState(false);

    const onSubmit: SubmitHandler<App.User.PasswordForm> = async data => {
        form.clearErrors('root');
        setSent(false);

        try {
            const response = await fetch(AUTH_API_CONFIG.CONSUMER_RESET_PASSWORD.URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ password: data.password })
            });

            const reply = (await response.json()) as { success: boolean; message?: string };

            if (reply.success) {
                setSent(true);
                form.reset();
            } else {
                form.setError('root', { message: reply.message ?? 'Could not start the password change.' });
            }
        } catch {
            form.setError('root', { message: 'The server is unavailable right now. Please try again.' });
        }
    };

    if (sent) {
        return (
            <Stack gap={3}>
                <Heading size="lg">Change password</Heading>
                <Alert.Root status="success">
                    <Alert.Indicator />
                    <Alert.Title>Check your email — we sent a link to confirm your new password. It isn&apos;t changed until you follow it.</Alert.Title>
                </Alert.Root>
            </Stack>
        );
    }

    return (
        <Stack gap={4}>
            <Heading size="lg">Change password</Heading>
            <Text color="fg.muted" fontSize="sm">
                Enter a new password — we&apos;ll email you a link to confirm the change.
            </Text>

            <form onSubmit={handleSubmit(onSubmit)}>
                <Stack gap={4}>
                    <Field.Root invalid={!!errors.password} gap="0">
                        <Field.Label>
                            <Text marginBottom={2}>New password</Text>
                        </Field.Label>
                        <Input type="password" autoComplete="new-password" {...register('password')} disabled={isSubmitting} />
                        <Field.ErrorText>{errors.password?.message}</Field.ErrorText>
                    </Field.Root>

                    <Field.Root invalid={!!errors.confirmPassword} gap="0">
                        <Field.Label>
                            <Text marginBottom={2}>Confirm new password</Text>
                        </Field.Label>
                        <Input type="password" autoComplete="new-password" {...register('confirmPassword')} disabled={isSubmitting} />
                        <Field.ErrorText>{errors.confirmPassword?.message}</Field.ErrorText>
                    </Field.Root>

                    {!!errors.root && (
                        <Alert.Root status="error">
                            <Alert.Indicator />
                            <Alert.Title>{errors.root.message}</Alert.Title>
                        </Alert.Root>
                    )}

                    <Button type="submit" disabled={isSubmitting} loading={isSubmitting} loadingText="Sending">
                        {isSubmitting && <Spinner size="sm" />}
                        <Text as="span">Email me a reset link</Text>
                    </Button>
                </Stack>
            </form>
        </Stack>
    );
}

PasswordForm.displayName = 'User.PasswordForm';
