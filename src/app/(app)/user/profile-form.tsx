'use client';

import * as React from 'react';
import { SubmitHandler, useForm, useWatch } from 'react-hook-form';

import { generateProfileHookFormPayload, profileFormSchema } from '@/@schema/user-profile';
import { AUTH_API_CONFIG } from '@/configs/api.config';
import { useAuth } from '@/contexts/auth';
import { Alert, Button, Field, HStack, Input, NativeSelect, Separator, Spinner, Stack, Text, VStack } from '@chakra-ui/react';

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

/**
 * The profile-edit form — the FIRST form on the /user account page.
 *
 * Prefilled from `profile` (fetched server-side in page.tsx via
 * GET /keen-api/consumer/profile). Saved through /api/consumer/update as a PARTIAL
 * update — a field cleared to blank is left unchanged, not wiped. Email is the
 * account identity and isn't editable here. On success the new display name is
 * pushed into the auth context so the header updates without a reload. If the
 * profile couldn't be loaded the form is blank (still works as a partial update).
 */
export function ProfileForm({ profile }: { profile: Keen.ConsumerProfile | null }) {
    const { identity, updateIdentity } = useAuth();
    const email = profile?.email ?? identity?.email;

    // Read the current year ONCE (state initializer, not render) so the list is
    // stable and no clock read happens during render.
    const [currentYear] = React.useState(() => new Date().getFullYear());
    const years = React.useMemo(() => Array.from({ length: 120 }, (_, i) => String(currentYear - i)), [currentYear]);

    const form = useForm<App.User.ProfileForm>(
        generateProfileHookFormPayload({
            firstName: profile?.firstName ?? '',
            lastName: profile?.lastName ?? '',
            gender: profile?.gender ?? '',
            dobDay: profile?.dobDay ?? '',
            dobMonth: profile?.dobMonth ?? '',
            dobYear: profile?.dobYear ?? ''
        })
    );

    const { register, formState, handleSubmit, control } = form;
    const { errors, isSubmitting, isDirty } = formState;

    const [saved, setSaved] = React.useState(false);

    // Enable Save only when the user actually changed something (isDirty, vs the
    // prefilled values) AND the form is valid (real, complete DOB).
    const values = useWatch({ control });
    const canSave = isDirty && profileFormSchema.safeParse(values).success;

    const onSubmit: SubmitHandler<App.User.ProfileForm> = async data => {
        form.clearErrors('root');
        setSaved(false);

        try {
            const response = await fetch(AUTH_API_CONFIG.CONSUMER_UPDATE.URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            const reply = (await response.json()) as App.User.ProfileUpdateReply;

            if (reply.success) {
                setSaved(true);

                // Reflect the new display name in the auth context immediately — the
                // header reads it, so it updates without a reload. username is
                // `${first} ${last}`; the form is prefilled with the full name, so both
                // parts are present. The token cookie was refreshed server-side, so the
                // next navigation reconciles the context with the authoritative token.
                const username = `${data.firstName} ${data.lastName}`.trim();
                if (username) {
                    updateIdentity({ username });
                }

                // Adopt the saved values as the new baseline — the form stays filled
                // and Save disables again until the next edit.
                form.reset(data);
            } else {
                form.setError('root', { message: reply.message ?? 'Could not save your details.' });
            }
        } catch {
            form.setError('root', { message: 'The server is unavailable right now. Please try again.' });
        }
    };

    return (
        <Stack gap={6}>
            {/* Email is the account identity (tenant key) — shown, not editable here. */}
            {email && (
                <Field.Root>
                    <Field.Label>
                        <Text marginBottom={2}>Email address</Text>
                    </Field.Label>
                    <Input value={email} readOnly disabled />
                    <Field.HelperText>Your email is your account identity and can&apos;t be changed here.</Field.HelperText>
                </Field.Root>
            )}

            {!profile && (
                <Alert.Root status="warning">
                    <Alert.Indicator />
                    <Alert.Title>We couldn&apos;t load your current details. You can still update any field below.</Alert.Title>
                </Alert.Root>
            )}

            <Separator />

            <form onSubmit={handleSubmit(onSubmit)}>
                <HStack w="100%" justifyContent="center" align="center">
                    <VStack gap="4" w="450px">
                        <Stack w="full" gap="2">
                            <Field.Root invalid={!!errors.firstName} gap="0">
                                <Field.Label>
                                    <Text marginBottom={2}>First name</Text>
                                </Field.Label>
                                <Input autoComplete="off" {...register('firstName')} disabled={isSubmitting} />
                                <Field.ErrorText>{errors.firstName?.message}</Field.ErrorText>
                            </Field.Root>

                            <Field.Root invalid={!!errors.lastName} gap="0">
                                <Field.Label>
                                    <Text marginBottom={2}>Last name</Text>
                                </Field.Label>
                                <Input autoComplete="off" {...register('lastName')} disabled={isSubmitting} />
                                <Field.ErrorText>{errors.lastName?.message}</Field.ErrorText>
                            </Field.Root>

                            <Field.Root invalid={!!errors.gender} gap="0">
                                <Field.Label>
                                    <Text marginBottom={2}>Gender</Text>
                                </Field.Label>
                                <NativeSelect.Root disabled={isSubmitting}>
                                    <NativeSelect.Field {...register('gender')}>
                                        <option value="">— Not set —</option>
                                        <option value="male">Male</option>
                                        <option value="female">Female</option>
                                        <option value="other">Other</option>
                                    </NativeSelect.Field>
                                    <NativeSelect.Indicator />
                                </NativeSelect.Root>
                                <Field.ErrorText>{errors.gender?.message}</Field.ErrorText>
                            </Field.Root>
                        </Stack>

                        <Stack w="full" gap="2">
                            <Field.Root invalid={!!errors.dobDay || !!errors.dobMonth || !!errors.dobYear} gap="0">
                                <Field.Label>
                                    <Text marginBottom={2}>Date of birth</Text>
                                </Field.Label>
                                <HStack w="full" gap={2} align="start">
                                    <NativeSelect.Root disabled={isSubmitting}>
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

                                    <NativeSelect.Root disabled={isSubmitting}>
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

                                    <NativeSelect.Root disabled={isSubmitting}>
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
                                <Field.ErrorText>{errors.dobDay?.message ?? errors.dobMonth?.message ?? errors.dobYear?.message}</Field.ErrorText>
                            </Field.Root>

                            {saved && (
                                <Alert.Root status="success">
                                    <Alert.Indicator />
                                    <Alert.Title>Your details were saved.</Alert.Title>
                                </Alert.Root>
                            )}

                            {!!errors.root && (
                                <Alert.Root status="error">
                                    <Alert.Indicator />
                                    <Alert.Title>{errors.root.message}</Alert.Title>
                                </Alert.Root>
                            )}

                            <Button type="submit" disabled={!canSave || isSubmitting} loading={isSubmitting} loadingText="Saving">
                                {isSubmitting && <Spinner size="sm" />}
                                <Text as="span">Save changes</Text>
                            </Button>
                        </Stack>
                    </VStack>
                </HStack>
            </form>
        </Stack>
    );
}

ProfileForm.displayName = 'User.ProfileForm';
