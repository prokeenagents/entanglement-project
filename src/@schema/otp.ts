import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

export const formSchema = z.object({
    pin: z
        .string()
        .min(6, {
            error: 'Invalid OTP number'
        })
        .max(6, {
            error: 'Invalid OTP number'
        })
});

export const generateLoginOtpHookFormPayload = () => {
    return {
        // 'onChange' so formState.isValid recomputes as the user types —
        // the Login button is gated on isValid, and the default 'onSubmit'
        // mode only revalidates on submit, leaving the button stuck disabled.
        // mode: 'onChange' as const,
        resolver: zodResolver(formSchema),
        defaultValues: {
            pin: ''
        }
    };
};
