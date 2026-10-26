import { describe, expect, it } from 'vitest';

import KeenValidator from '@/service/services/keen/keen.validator';
import { passwordFormSchema } from './account-password';
import { formSchema as loginSchema } from './login';
import { PASSWORD_HINT } from './password';
import { wireSchema as registrationSchema } from './registration';
import { formSchema as resetSchema } from './reset-password';

const registration = (password: string) => ({
    firstName: 'Ana',
    lastName: 'Ivanova',
    email: 'ana@example.com',
    password,
    confirmPassword: password,
    gender: 'female',
    consent: true,
    dob: '1990-05-17'
});

const serverAccepts = (password: string) => {
    try {
        KeenValidator.validatePassword(password);
        return true;
    } catch {
        return false;
    }
};

// The beta tester's case: 8+ chars passed the forms, then the server refused it.
const CASES = ['password', 'PASSWORD1', 'password1', 'Password', 'Pass1', 'Password1', 'Str0ngerPass!'];

describe('one password rule', () => {
    it.each(CASES)('forms and server agree on %s', password => {
        const server = serverAccepts(password);

        expect(registrationSchema.safeParse(registration(password)).success).toBe(server);
        expect(resetSchema.safeParse({ email: 'ana@example.com', password, confirmPassword: password }).success).toBe(server);
        expect(passwordFormSchema.safeParse({ password, confirmPassword: password }).success).toBe(server);
    });

    it('tells the user the rule instead of a generic error', () => {
        const result = registrationSchema.safeParse(registration('password1'));

        expect(result.success).toBe(false);
        expect(result.error?.issues.find(issue => issue.path[0] === 'password')?.message).toBe(PASSWORD_HINT);
    });

    it('lets an account with an older, weaker password sign in', () => {
        expect(loginSchema.safeParse({ email: 'ana@example.com', password: 'oldpw' }).success).toBe(true);
        expect(() => KeenValidator.validateLoginPassword('oldpw')).not.toThrow();
        expect(loginSchema.safeParse({ email: 'ana@example.com', password: '' }).success).toBe(false);
    });
});
