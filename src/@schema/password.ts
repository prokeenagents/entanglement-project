import { z } from 'zod';

/**
 * The ONE password rule for every NEW password the site sends to Keen
 * (registration, forgot-password, change-password). The forms, the API routes and
 * KeenValidator all read it from here, so the button can never enable on a
 * password the server then refuses as "server unavailable".
 *
 * Login deliberately does NOT use it: an account created under an older, weaker
 * rule must still be able to sign in. Login only needs a non-empty password.
 */
export const PASSWORD_PATTERN = /^(?=.*\d)(?=.*[A-Z])(?=.*[a-z]).{8,}$/;

export const PASSWORD_HINT = 'At least 8 characters, with an uppercase letter, a lowercase letter and a number.';

export const newPasswordSchema = z.string().regex(PASSWORD_PATTERN, { error: PASSWORD_HINT });

export const isValidNewPassword = (password: string): boolean => PASSWORD_PATTERN.test(password);
