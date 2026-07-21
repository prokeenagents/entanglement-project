'use client';

/**
 * Global
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch, SubmitHandler } from 'react-hook-form';

import { formSchema, generateLoginHookFormPayload } from '@/@schema/login';
import { Button, Field, HStack, Input, Spinner, Stack, Text, VStack } from '@chakra-ui/react';
import { useLogin } from '@/hooks/login';
import { LocalStorage } from '@/utils/localStorage';
import { OTP_CONFIG } from '@/configs/otp.config';
import { PAGE_CONFIG } from '@/configs/page.config';
import { Logo } from '@/components/ui/logo';
import { CardShell } from '@/components/ui/card-shell';

export const Component: React.FC<{
    otpState: App.ReactState<boolean>;
    hashState: App.ReactState<App.Login.HashObject>;
}> = props => {
    const { otpState, hashState } = props;

    const [isOtp, setOtp] = otpState;
    const [hash, setHash] = hashState;

    const router = useRouter();
    const form = useForm<App.Login.Form>(generateLoginHookFormPayload());
    const loginHook = useLogin();

    const { register, formState, handleSubmit, control } = form;
    const { errors } = formState;

    // Drive the button off the live values via the schema directly, instead of
    // formState.isValid — isValid depends on useForm's mode (captured at mount,
    // so Fast Refresh won't re-apply it) and on validation having already run.
    // useWatch (not the imperative watch(), which React Compiler can't memoize)
    // re-renders on every keystroke, so this flips the moment values pass.
    const values = useWatch({ control });
    const isFormValid = formSchema.safeParse(values).success;

    const onSubmit: SubmitHandler<App.Login.Form> = async data => {
        form.clearErrors('root');

        const outcome = await loginHook.login(data);

        switch (outcome.kind) {
            case 'success':
                // Session cookies are set by /api/login and the proxy now admits the
                // session. Replace (not push) so /login stays out of history, and
                // refresh() so the router cache re-evaluates through middleware with
                // the new cookie.
                setOtp(false);
                LocalStorage.delete(OTP_CONFIG.STORAGE_KEY);

                router.replace('/');
                router.refresh();
                return;

            case 'otp':
                // Hand the hash to the OTP form via the shared state, and mirror it to
                // storage so the step survives a reload. `timestamp` is the DEADLINE
                // (not the mint time) — Content expires the hash once it passes.
                const hashData = {
                    hash: outcome.hash,
                    timestamp: new Date().getTime() + OTP_CONFIG.TTL_MS
                };

                // setJson, not create: create() refuses to overwrite an existing key,
                // so a leftover entry would silently keep the OLD hash in storage
                // while state moved on to the new one.
                LocalStorage.setJson(OTP_CONFIG.STORAGE_KEY, hashData);
                setHash(hashData);
                setOtp(true);

                return;

            case 'rejected':
                setOtp(false);
                setHash(null);
                LocalStorage.delete(OTP_CONFIG.STORAGE_KEY);
                form.setError('root', { message: 'Invalid email or password.' });
                return;

            case 'server-error':
                setOtp(false);
                setHash(null);
                LocalStorage.delete(OTP_CONFIG.STORAGE_KEY);

                form.setError('root', { message: 'The server is unavailable right now. Please try again.' });
                return;
        }
    };

    if (isOtp) {
        return <></>;
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
                <CardShell title="Sign In" description="Fill in the form below to login.">
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
                                            <Text marginBottom={2}>Password</Text>
                                        </Field.Label>
                                        <Input autoComplete="off" type="password" {...register('password')} disabled={form.formState.isSubmitting} />
                                        <Field.ErrorText>
                                            <Text as="span">{errors.password?.message}</Text>
                                        </Field.ErrorText>
                                    </Field.Root>
                                </Stack>

                                <Stack w="full" gap="2" justifyContent="center" align="center">
                                    <Field.Root invalid={!!errors.root}>
                                        <Button disabled={form.formState.isSubmitting || !isFormValid} type="submit" w="full">
                                            {form.formState.isSubmitting && <Spinner size="sm" />}
                                            <Text as="span">Login</Text>
                                        </Button>

                                        {/* type="button": inside a <form> a button defaults to
                                    type="submit", so without it this would attempt a
                                    real login on its way to the reset page. */}
                                        <HStack justifyContent="space-between" w="full">
                                            <Button
                                                type="button"
                                                variant="plain"
                                                onClick={() => {
                                                    router.push(PAGE_CONFIG.RESET_PASSWORD.URL);
                                                }}
                                            >
                                                <Text as="span">Forgot your password?</Text>
                                            </Button>

                                            <Button
                                                type="button"
                                                variant="plain"
                                                onClick={() => {
                                                    router.push(PAGE_CONFIG.REGISTRATION.URL);
                                                }}
                                            >
                                                <Text as="span">Sign up</Text>
                                            </Button>
                                        </HStack>
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

Component.displayName = 'Login.Form';
