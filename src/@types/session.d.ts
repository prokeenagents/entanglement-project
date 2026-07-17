export {};

declare global {
    namespace App {
        namespace Session {
            /** The consumer session tokens written to httpOnly cookies at login. */
            interface Tokens {
                accessToken: string;
                refreshToken?: string;
                expiresIn?: number;
            }

            /**
             * Result of evaluating the session cookies.
             *  - authenticated: refresh token exists and is valid (unexpired).
             *  - authorized:    access token exists and is valid AND authenticated.
             * authorized is always false when authenticated is false.
             */
            interface State {
                authorized: boolean;
                authenticated: boolean;
            }
        }
    }
}
