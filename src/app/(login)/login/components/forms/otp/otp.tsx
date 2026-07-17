'use client';

/**
 * Global
 */
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch, SubmitHandler } from 'react-hook-form';

import { formSchema, generateLoginOtpHookFormPayload } from '@/@schema/otp';
import { Button, Field, HStack, PinInput, Progress, Stack, Text, VStack } from '@chakra-ui/react';
import { useLogin } from '@/hooks/login';
import { LocalStorage } from '@/utils/localStorage';
import { OTP_CONFIG } from '@/configs/otp.config';
import { CardShell } from '@/components/ui/card-shell';
import { Logo } from '@/components/ui/logo';

export const Component: React.FC<{
    otpState: App.ReactState<boolean>;
    hashState: App.ReactState<App.Login.HashObject>;
    /**
     * Abandon the pending OTP — Content's expire(), which drops the hash from
     * storage as well as state. Backs the Cancel button; the same callback the
     * TTL timer fires, so cancelling and timing out land in exactly one place.
     */
    onExpire: () => void;
}> = props => {
    const { otpState, hashState, onExpire } = props;

    const [hash] = hashState;
    const [isOtp] = otpState;

    const router = useRouter();
    const form = useForm<App.Login.Otp>(generateLoginOtpHookFormPayload());

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

    // The deadline is a fixed number, so nothing re-renders as it approaches —
    // hold the clock in state and tick it to drive the countdown. VIEW ONLY: the
    // actual expiry is Content's one-shot timer, so if this interval is throttled
    // (browsers slow timers in background tabs) the bar just redraws late; the
    // hash still dies on time.
    const [now, setNow] = React.useState(() => new Date().getTime());

    React.useEffect(() => {
        if (!hash) {
            return;
        }

        const ticker = window.setInterval(() => setNow(new Date().getTime()), OTP_CONFIG.TICK_MS);

        return () => window.clearInterval(ticker);
    }, [hash]);

    // `timestamp` is mint-time + TTL_MS, so what's left OVER TTL_MS is the fraction
    // of the window still to run. That holds for a hash resumed mid-life too — a
    // reload 90s into a 120s window reads 25%, not 100%. Progress.Root defaults to
    // min 0 / max 100, so this feeds `value` as-is.
    const remainingMs = hash ? Math.max(0, hash.timestamp - now) : 0;
    const percentLeft = Math.min(100, (remainingMs / OTP_CONFIG.TTL_MS) * 100);

    const secondsLeft = Math.ceil(remainingMs / 1000);
    const countdown = `${Math.floor(secondsLeft / 60)}:${String(secondsLeft % 60).padStart(2, '0')}`;

    const onSubmit: SubmitHandler<App.Login.Otp> = async data => {
        form.clearErrors('root');

        if (!hash?.hash) {
            return;
        }

        const outcome = await loginHook.otp({
            pin: data.pin,
            hash: hash?.hash
        });

        switch (outcome.kind) {
            case 'success':
                // Session cookies are set by /api/login and the proxy now admits the
                // session. Replace (not push) so /login stays out of history, and
                // refresh() so the router cache re-evaluates through middleware with
                // the new cookie.

                LocalStorage.delete(OTP_CONFIG.STORAGE_KEY);
                router.replace('/');
                router.refresh();
                return;

            case 'rejected':
                form.setError('root', { message: 'Invalid otp pin.' });
                return;

            case 'server-error':
                LocalStorage.delete(OTP_CONFIG.STORAGE_KEY);
                form.setError('root', { message: 'The server is unavailable right now. Please try again.' });
                return;
        }
    };

    if (!isOtp) {
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
                <CardShell title="OTP - Sign In" description="Check your mail box and enter the OTP code.">
                    <form action="/" onSubmit={handleSubmit(onSubmit)}>
                        <HStack w="100%" justifyContent="center" align="center">
                            <VStack gap="4" w="450px">
                                <Stack gap="4">
                                    <Progress.Root w="100%" maxW="100%" value={percentLeft}>
                                        <Progress.Label mb="2" w="100%">
                                            <Text marginBottom={2}>One-time code — expires in {countdown}</Text>
                                        </Progress.Label>
                                        <Progress.Track>
                                            <Progress.Range />
                                        </Progress.Track>
                                    </Progress.Root>

                                    <Field.Root invalid={!!errors.pin || !!errors.root}>
                                        <Field.Label w="100%"></Field.Label>
                                        <PinInput.Root>
                                            <PinInput.HiddenInput {...register('pin')} disabled={form.formState.isSubmitting} />
                                            <PinInput.Control>
                                                <PinInput.Input index={0} />
                                                <PinInput.Input index={1} />
                                                <PinInput.Input index={2} />
                                                <PinInput.Input index={3} />
                                                <PinInput.Input index={4} />
                                                <PinInput.Input index={5} />
                                            </PinInput.Control>
                                        </PinInput.Root>
                                        <Field.ErrorText>
                                            <Text as="span">{errors.pin?.message}</Text>
                                        </Field.ErrorText>
                                    </Field.Root>
                                </Stack>

                                <HStack gap="4">
                                    <Field.Root invalid={!!errors.root}>
                                        <Button disabled={form.formState.isSubmitting || !isFormValid} type="submit">
                                            <Text as="span">Login</Text>
                                        </Button>
                                    </Field.Root>

                                    <Field.Root invalid={!!errors.root}>
                                        {/* type="button" is load-bearing: a <button> inside a <form>
                            defaults to type="submit", so without it Cancel would ALSO
                            submit the PIN it is meant to discard. */}
                                        <Button type="button" disabled={form.formState.isSubmitting} onClick={onExpire}>
                                            <Text as="span">Cancel</Text>
                                        </Button>
                                    </Field.Root>
                                </HStack>

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

Component.displayName = 'Otp.Form';
