import { isValidNewPassword } from '@/@schema/password';

export default class KeenValidator {
    static validateEmail(email: string) {
        if (!email) {
            throw new Error('Email must be valid string.');
        }

        const REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        if (!REGEX.test(email)) {
            throw new Error('The email is not valid!');
        }
    }

    /** A NEW password (registration / reset / change) — the shared rule in @schema/password. */
    static validatePassword(password: string) {
        if (!password) {
            throw new Error('Password must be valid string.');
        }

        if (!isValidNewPassword(password)) {
            throw new Error('The password is not valid format!');
        }
    }

    /** A login password: only presence. Older accounts may predate the current rule. */
    static validateLoginPassword(password: string) {
        if (!password) {
            throw new Error('Password must be valid string.');
        }
    }

    static validateToken(token: string) {
        if (!token) {
            throw new Error('Token must be valid string.');
        }

        if (token.length < 80) {
            throw new Error('Invalid token.');
        }
    }
}
