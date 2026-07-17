'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useWatch, SubmitHandler } from 'react-hook-form';

import { formSchema, generateRegistrationHookFormPayload, toDob } from '@/@schema/registration';
import { Box, Button, Field, Heading, HStack, Input, NativeSelect, Separator, Stack, Text, VStack } from '@chakra-ui/react';
import { PAGE_CONFIG } from '@/configs/page.config';
import { useLogin } from '@/hooks/login';
import { CardShell } from '@/components/ui/card-shell';
import { Logo } from '@/components/ui/logo';

const MONTHS = [
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
];

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

export const Component: React.FC = () => {
    const router = useRouter();
    const form = useForm<App.Registration.Form>(generateRegistrationHookFormPayload());
    const loginHook = useLogin();

    // current year read ONCE (state initializer, not render) so the year list is
    // stable and the compiler doesn't flag a clock read during render.
    const [currentYear] = React.useState(() => new Date().getFullYear());
    const years = React.useMemo(() => Array.from({ length: 120 }, (_, i) => String(currentYear - i)), [currentYear]);

    // The claim landed and Keen emailed a verification link — nothing more to do
    // here, so swap the form for "check your inbox" (a resubmit would mint a second
    // link and invalidate the first).
    const [sent, setSent] = React.useState(false);

    const { register, formState, handleSubmit, control } = form;
    const { errors } = formState;

    // Drive the button off the live values via the schema directly (see the login
    // form for the why) so it flips the moment every field — incl. the passwords-
    // match refine and the consent tick — passes.
    const values = useWatch({ control });
    const isFormValid = formSchema.safeParse(values).success;

    const onSubmit: SubmitHandler<App.Registration.Form> = async data => {
        form.clearErrors('root');

        // Fold the three date fields into Keen's "YYYY-MM-DD" wire value.
        const { dobDay, dobMonth, dobYear, ...rest } = data;
        const outcome = await loginHook.registration({ ...rest, dob: toDob({ dobDay, dobMonth, dobYear }) });

        switch (outcome.kind) {
            case 'sent':
                // NOT a redirect: the account isn't created until they follow the
                // emailed link. Show "check your inbox" and let the link drive the rest.
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

                    <Text>If that email address is available, we&apos;ve sent it a link to finish creating your account. Nothing is created until you follow it.</Text>

                    <Separator w="full" />

                    <Button type="button" variant="plain" w="full" onClick={() => router.push(PAGE_CONFIG.LOGIN.URL)}>
                        <Text as="span">Back to login</Text>
                    </Button>
                </VStack>
            </HStack>
        );
    }

    return (
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
            <CardShell title="Sign Up" description="Fill in the form below to create an account.">
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

                                <Field.Root invalid={!!errors.confirmPassword || !!errors.root} gap="0">
                                    <Field.Label>
                                        <Text marginBottom={2}>Confirm Password</Text>
                                    </Field.Label>
                                    <Input autoComplete="off" type="password" {...register('confirmPassword')} disabled={form.formState.isSubmitting} />
                                    <Field.ErrorText>
                                        <Text as="span">{errors.confirmPassword?.message}</Text>
                                    </Field.ErrorText>
                                </Field.Root>

                                <Field.Root invalid={!!errors.gender || !!errors.root} gap="0">
                                    <Field.Label>
                                        <Text marginBottom={2}>Gender</Text>
                                    </Field.Label>
                                    <NativeSelect.Root disabled={form.formState.isSubmitting}>
                                        <NativeSelect.Field {...register('gender')}>
                                            <option value="male">Male</option>
                                            <option value="female">Female</option>
                                            <option value="other">Other</option>
                                        </NativeSelect.Field>
                                        <NativeSelect.Indicator />
                                    </NativeSelect.Root>
                                    <Field.ErrorText>
                                        <Text as="span">{errors.gender?.message}</Text>
                                    </Field.ErrorText>
                                </Field.Root>

                                <HStack w="full" gap="2" align="start">
                                    <Field.Root invalid={!!errors.firstName || !!errors.root} gap="0">
                                        <Field.Label>
                                            <Text marginBottom={2}>First name</Text>
                                        </Field.Label>
                                        <Input autoComplete="off" type="text" {...register('firstName')} disabled={form.formState.isSubmitting} />
                                        <Field.ErrorText>
                                            <Text as="span">{errors.firstName?.message}</Text>
                                        </Field.ErrorText>
                                    </Field.Root>

                                    <Field.Root invalid={!!errors.lastName || !!errors.root} gap="0">
                                        <Field.Label>
                                            <Text marginBottom={2}>Last name</Text>
                                        </Field.Label>
                                        <Input autoComplete="off" type="text" {...register('lastName')} disabled={form.formState.isSubmitting} />
                                        <Field.ErrorText>
                                            <Text as="span">{errors.lastName?.message}</Text>
                                        </Field.ErrorText>
                                    </Field.Root>
                                </HStack>

                                <Field.Root invalid={!!errors.dobDay || !!errors.dobMonth || !!errors.dobYear || !!errors.root} gap="0">
                                    <Field.Label>
                                        <Text marginBottom={2}>Date of birth</Text>
                                    </Field.Label>
                                    <HStack w="full" gap="2" align="start">
                                        <NativeSelect.Root disabled={form.formState.isSubmitting}>
                                            <NativeSelect.Field {...register('dobDay')}>
                                                <option value="">Day</option>
                                                {DAYS.map(d => (
                                                    <option key={d} value={d}>
                                                        {d}
                                                    </option>
                                                ))}
                                            </NativeSelect.Field>
                                            <NativeSelect.Indicator />
                                        </NativeSelect.Root>

                                        <NativeSelect.Root disabled={form.formState.isSubmitting}>
                                            <NativeSelect.Field {...register('dobMonth')}>
                                                <option value="">Month</option>
                                                {MONTHS.map(m => (
                                                    <option key={m.value} value={m.value}>
                                                        {m.label}
                                                    </option>
                                                ))}
                                            </NativeSelect.Field>
                                            <NativeSelect.Indicator />
                                        </NativeSelect.Root>

                                        <NativeSelect.Root disabled={form.formState.isSubmitting}>
                                            <NativeSelect.Field {...register('dobYear')}>
                                                <option value="">Year</option>
                                                {years.map(y => (
                                                    <option key={y} value={y}>
                                                        {y}
                                                    </option>
                                                ))}
                                            </NativeSelect.Field>
                                            <NativeSelect.Indicator />
                                        </NativeSelect.Root>
                                    </HStack>
                                    <Field.ErrorText>
                                        <Text as="span">{errors.dobDay?.message ?? errors.dobMonth?.message ?? errors.dobYear?.message}</Text>
                                    </Field.ErrorText>
                                </Field.Root>

                                <Field.Root invalid={!!errors.consent || !!errors.root} gap="0">
                                    <HStack gap="2" align="center">
                                        <input type="checkbox" {...register('consent')} disabled={form.formState.isSubmitting} />
                                        <Text as="span" fontSize="sm">
                                            I accept the terms and conditions.
                                        </Text>
                                    </HStack>
                                    <Field.ErrorText>
                                        <Text as="span">{errors.consent?.message}</Text>
                                    </Field.ErrorText>
                                </Field.Root>
                            </Stack>

                            <Separator w="full" />

                            <Stack w="full" gap="2" justifyContent="center" align="center">
                                <Field.Root invalid={!!errors.root}>
                                    <Button disabled={form.formState.isSubmitting || !isFormValid} type="submit" w="full">
                                        <Text as="span">Create account</Text>
                                    </Button>

                                    {/* type="button": inside a <form> a button defaults to submit. */}
                                    <Button type="button" variant="plain" w="full" onClick={() => router.push(PAGE_CONFIG.LOGIN.URL)}>
                                        <Text as="span">Back to login</Text>
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
    );
};

Component.displayName = 'Registration.Form';
