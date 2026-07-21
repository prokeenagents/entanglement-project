import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * The consumer profile edit — the fields `consumer.update` accepts (name, gender,
 * date of birth). Email + password are out of scope: email is the account identity
 * (tenant key), password has its own reset flow.
 *
 * This is a PARTIAL update: every field is optional and blank means "leave
 * unchanged" — the route forwards only the non-empty ones. The form is PREFILLED
 * from GET /api/consumer/profile, so it reads as a normal edit; a field the consumer
 * clears is simply not sent. Gender's '' option is "keep current"; DOB is
 * all-three-or-none and a real date.
 */

/** True only for a real calendar date — rejects Feb 30, month 13, etc. */
const isRealDate = (year: string, month: string, day: string): boolean => {
    const y = Number(year);
    const m = Number(month);
    const d = Number(day);

    if (!Number.isInteger(y) || !Number.isInteger(m) || !Number.isInteger(d)) {
        return false;
    }

    const dt = new Date(y, m - 1, d);

    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
};

export const profileFormSchema = z
    .object({
        firstName: z.string().trim().max(100),
        lastName: z.string().trim().max(100),
        gender: z.enum(['', 'male', 'female', 'other']),
        dobDay: z.string(),
        dobMonth: z.string(),
        dobYear: z.string()
    })
    // DOB is all-or-nothing: leave all three blank (unchanged) or set all three.
    .refine(
        data => {
            const filled = [data.dobDay, data.dobMonth, data.dobYear].filter(Boolean).length;

            return filled === 0 || filled === 3;
        },
        { error: 'Enter the full date of birth', path: ['dobDay'] }
    )
    // ...and a real calendar date when set.
    .refine(data => !(data.dobDay && data.dobMonth && data.dobYear) || isRealDate(data.dobYear, data.dobMonth, data.dobDay), {
        error: 'Invalid date of birth',
        path: ['dobDay']
    });

/** Seed react-hook-form, prefilling from the fetched profile (blank for null fields). */
export const generateProfileHookFormPayload = (defaultValues?: Partial<App.User.ProfileForm>) => ({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
        firstName: '',
        lastName: '',
        gender: '',
        dobDay: '',
        dobMonth: '',
        dobYear: '',
        ...defaultValues
    } as App.User.ProfileForm
});
