import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * The logged-in "change my password" form on the account page.
 *
 * Collects only the NEW password + a confirm — the email is the signed-in user's
 * own (resolved server-side from the token), never typed here, and the current
 * password isn't needed because the live session (the access token) is the proof of
 * identity. Nothing changes on submit: the claim leg emails a confirm link, and the
 * password applies only when that link is followed.
 */
export const passwordFormSchema = z
    .object({
        password: z.string().min(8, { error: 'At least 8 characters' }),
        confirmPassword: z.string().min(8, { error: 'Confirm your new password' })
    })
    // Without this the confirm field is decorative (each only has to be 8+ chars).
    .refine(data => data.password === data.confirmPassword, { error: 'Passwords do not match', path: ['confirmPassword'] });

export const generatePasswordHookFormPayload = () => ({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: '', confirmPassword: '' }
});
