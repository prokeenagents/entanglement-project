'use client';

/**
 * Global
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch, SubmitHandler } from 'react-hook-form';

import { formSchema, generateResetPasswordHookFormPayload } from '@/@schema/reset-password';
import { Box, Button, Field, Heading, HStack, Input, Separator, Stack, Text, VStack } from '@chakra-ui/react';
import { PAGE_CONFIG } from '@/configs/page.config';
import { useLogin } from '@/hooks/login';
import { Logo } from '@/components/ui/logo';
import { CardShell } from '@/components/ui/card-shell';

export const Component: React.FC = () => {
    const router = useRouter();
    const form = useForm<App.Login.ResetPasswordForm>(generateResetPasswordHookFormPayload());
    const loginHook = useLogin();

    // The claim landed and Keen has emailed a link. There is nothing more to do on
    // this page, so the form is replaced rather than left submittable — re-posting
    // would mint a second link and invalidate the first.
    const [sent, setSent] = React.useState(false);

    const { register, formState, handleSubmit, control } = form;
    const { errors } = formState;

    // Drive the button off the live values via the schema directly, instead of
    // formState.isValid — isValid depends on useForm's mode (captured at mount,
    // so Fast Refresh won't re-apply it) and on validation having already run.
    // useWatch (not the imperative watch(), which React Compiler can't memoize)
    // re-renders on every keystroke, so this flips the moment values pass.
    const values = useWatch({ control });
    const isFormValid = formSchema.safeParse(values).success;

    const onSubmit: SubmitHandler<App.Login.ResetPasswordForm> = async data => {
        form.clearErrors('root');

        const outcome = await loginHook.resetPassword(data);

        switch (outcome.kind) {
            case 'sent':
                // Deliberately NOT a redirect to /login: the password hasn't changed
                // yet, so sending them to sign in would invite them to try the new one
                // and fail. Swap the form for "check your inbox" and let the emailed
                // link drive the rest.
                setSent(true);
                return;

            case 'rejected':
                form.setError('root', { message: outcome.message });
                return;

            case 'server-error':
                form.setError('root', { message: 'The server is unavailable right now. Please try again.' });
                return;
        }
    };

    if (sent) {
        return (
            <HStack w="100%" justifyContent="center" align="center">
                <VStack gap="4" w="450px" align="stretch">
                    <Heading size="2xl" mb={2}>
                        Check your inbox
                    </Heading>

                    <Text>If that email address has an account, we&apos;ve sent it a link to finish resetting your password. Your password stays unchanged until you follow it.</Text>

                    <Separator w="full" />

                    <Button type="button" variant="plain" w="full" onClick={() => router.push(PAGE_CONFIG.LOGIN.URL)}>
                        <Text as="span">Back to login</Text>
                    </Button>
                </VStack>
            </HStack>
        );
    }

    return (
        <>
            <VStack gap="8">
                <HStack gap="1">
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
                <CardShell title="Reset your password" description="Fill the form bellow and follow the instruction received in your mail box.">
                    <form action="/" onSubmit={handleSubmit(onSubmit)}>
                        <HStack w="100%" justifyContent="center" align="center">
                            <VStack gap="4" w="450px">
                                <Stack w="full" gap="2">
                                    <Field.Root invalid={!!errors.email || !!errors.root} gap="0">
                                        <Field.Label>
                                            <Text marginBottom={2}>Email address</Text>
                                        </Field.Label>
                                        <Input autoComplete="off" type="email" {...register('email')} disabled={form.formState.isSubmitting} />
                                        <Field.ErrorText>
                                            <Text as="span">{errors.email?.message}</Text>
                                        </Field.ErrorText>
                                    </Field.Root>

                                    <Field.Root invalid={!!errors.password || !!errors.root} gap="0">
                                        <Field.Label>
                                            <Text marginBottom={2}>New Password</Text>
                                        </Field.Label>
                                        <Input autoComplete="off" type="password" {...register('password')} disabled={form.formState.isSubmitting} />
                                        <Field.ErrorText>
                                            <Text as="span">{errors.password?.message}</Text>
                                        </Field.ErrorText>
                                    </Field.Root>

                                    <Field.Root invalid={!!errors.confirmPassword || !!errors.root} gap="0">
                                        <Field.Label>
                                            <Text marginBottom={2}>Confirm Password</Text>
                                        </Field.Label>
                                        <Input autoComplete="off" type="password" {...register('confirmPassword')} disabled={form.formState.isSubmitting} />
                                        <Field.ErrorText>
                                            <Text as="span">{errors.confirmPassword?.message}</Text>
                                        </Field.ErrorText>
                                    </Field.Root>
                                </Stack>

                                <Separator w="full" />

                                <Stack w="full" gap="2" justifyContent="center" align="center">
                                    <Field.Root invalid={!!errors.root}>
                                        <Button disabled={form.formState.isSubmitting || !isFormValid} type="submit" w="full">
                                            <Text as="span">Submit</Text>
                                        </Button>

                                        {/* type="button": inside a <form> a button defaults to
                                    type="submit", so without it Go Back would fire a
                                    reset claim on its way to the login page. */}
                                        <Button type="button" variant="plain" w="full" onClick={() => router.push(PAGE_CONFIG.LOGIN.URL)}>
                                            <Text as="span">Go Back</Text>
                                        </Button>
                                    </Field.Root>
                                </Stack>

                                {!!errors.root && (
                                    <Stack w="full" gap="2" justifyContent="center" align="center">
                                        <Text as="span" color="red.500">
                                            {errors.root?.message}
                                        </Text>
                                    </Stack>
                                )}
                            </VStack>
                        </HStack>
                    </form>
                </CardShell>
            </VStack>
        </>
    );
};

Component.displayName = 'ResetPassword.Form';
