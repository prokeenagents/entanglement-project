import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * The logged-out ("outside") registration claim. Password is collected up front and
 * Keen parks the whole thing behind a hash emailed to the consumer — nothing is
 * created until they follow the link and the redeem leg runs.
 *
 * Date of birth is THREE fields in the form (day / month / year) but ONE string on
 * the wire: Keen wants "YYYY-MM-DD" (it splits on `-`). So the FORM validates the
 * parts (`formSchema`), the form combines them via `toDob`, and the API re-validates
 * the combined value (`wireSchema`) — the server enforces the same rules either way.
 */

/** Shared leaves so the form + wire schemas can't drift on the common fields. */
const commonFields = {
    firstName: z.string().trim().min(1, { error: 'First name is required' }).max(100),
    lastName: z.string().trim().min(1, { error: 'Last name is required' }).max(100),
    email: z.email().min(2, { error: 'Invalid email' }),
    password: z.string().min(8, { error: 'Invalid password' }),
    confirmPassword: z.string().min(8, { error: 'Invalid confirm password' }),
    gender: z.enum(['male', 'female', 'other'], { error: 'Select a gender' }),
    // A checkbox — boolean().refine (not literal(true)) so the inferred type stays
    // `boolean`, matching the `false` default; the refine still rejects an unticked box.
    consent: z.boolean().refine(value => value === true, { error: 'You must accept the terms to continue' })
};

const passwordsMatch = (data: { password: string; confirmPassword: string }) => data.password === data.confirmPassword;

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

/** Combine the three form fields into Keen's "YYYY-MM-DD" wire value. */
export const toDob = (v: { dobDay: string; dobMonth: string; dobYear: string }): string => {
    return `${v.dobYear}-${v.dobMonth.padStart(2, '0')}-${v.dobDay.padStart(2, '0')}`;
};

/** CLIENT form shape — day/month/year as separate selects. */
export const formSchema = z
    .object({
        ...commonFields,
        dobDay: z.string().min(1, { error: 'Day' }),
        dobMonth: z.string().min(1, { error: 'Month' }),
        dobYear: z.string().min(1, { error: 'Year' })
    })
    .refine(passwordsMatch, { error: 'Passwords do not match', path: ['confirmPassword'] })
    .refine(data => isRealDate(data.dobYear, data.dobMonth, data.dobDay), { error: 'Invalid date of birth', path: ['dobDay'] });

/** WIRE shape — what /api/registration receives and re-validates: dob combined. */
export const wireSchema = z
    .object({
        ...commonFields,
        dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Invalid date of birth' })
    })
    .refine(passwordsMatch, { error: 'Passwords do not match', path: ['confirmPassword'] })
    // Shape isn't enough — reject a well-formed-but-impossible date (2020-02-30) on
    // the server too, matching the client's real-date check.
    .refine(
        data => {
            const [year, month, day] = data.dob.split('-');
            return isRealDate(year, month, day);
        },
        { error: 'Invalid date of birth', path: ['dob'] }
    );

export const generateRegistrationHookFormPayload = () => {
    return {
        resolver: zodResolver(formSchema),
        defaultValues: {
            firstName: '',
            lastName: '',
            email: '',
            password: '',
            confirmPassword: '',
            gender: 'male' as const,
            dobDay: '',
            dobMonth: '',
            dobYear: '',
            consent: false
        }
    };
};
