import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * The logged-out "forgot password" claim.
 *
 * `password` is the password the consumer wants to END UP with, not their current
 * one — the claim leg carries the new secret up front and Keen parks it behind a
 * hash. Nothing changes until they click the emailed link and the redeem leg
 * applies it. Same shape as the login form by coincidence, deliberately not the
 * same schema: these two mean different things and will drift (a confirm-password
 * field belongs here, never on login).
 */
export const formSchema = z
    .object({
        email: z.email().min(2, {
            error: 'Invalid email'
        }),

        password: z.string().min(8, {
            error: 'Invalid password'
        }),

        confirmPassword: z.string().min(8, {
            error: 'Invalid confirm password'
        })
    })
    // Without this the confirm field is decorative — each value only has to be 8+
    // chars, so password/confirmPassword could differ and still validate. `path`
    // pins the error to the confirm field so it renders under it rather than as a
    // form-level root error. /api/reset-password re-parses with this same schema,
    // so the server enforces the match too — it isn't taking the client's word.
    .refine(data => data.password === data.confirmPassword, {
        error: 'Passwords do not match',
        path: ['confirmPassword']
    });

export const generateResetPasswordHookFormPayload = () => {
    return {
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: '',
            password: '',
            confirmPassword: ''
        }
    };
};
