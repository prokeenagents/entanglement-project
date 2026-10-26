import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

/**
 * Login checks only that a password was typed — never the new-password rule in
 * @schema/password — so an account made under an older, weaker rule can still sign in.
 */
export const formSchema = z.object({
    email: z.email().min(2, {
        error: 'Invalid email'
    }),

    password: z.string().min(1, {
        error: 'Enter your password'
    })
});

export const generateLoginHookFormPayload = () => {
    return {
        // 'onChange' so formState.isValid recomputes as the user types —
        // the Login button is gated on isValid, and the default 'onSubmit'
        // mode only revalidates on submit, leaving the button stuck disabled.
        // mode: 'onChange' as const,
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: '',
            password: ''
        }
    };
};
