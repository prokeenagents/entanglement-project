export {};

declare global {
    namespace App {
        namespace Login {
            type Otp<T extends Record<string, string> = Record<never, never>> = T & {
                pin: string;
            };

            interface Form {
                email: string;
                password: string;
            }

            interface ResetPasswordForm {
                email: string;
                password: string;
                confirmPassword: string;
            }

            /**
             * The three shapes the /api/reset-password reply collapses to, as a
             * discriminated union so callers just switch on `kind`:
             *  - 'sent'         → Keen accepted the claim and emailed the reset link.
             *                     Carries no payload, and explicitly does NOT mean the
             *                     password changed — that only happens once the
             *                     consumer clicks through and the redeem leg runs.
             *  - 'rejected'     → the server answered and said no.
             *  - 'server-error' → 5xx / not ready / unreachable — reached but errored.
             */
            type ResetPasswordOutcome = { kind: 'sent' } | { kind: 'rejected'; message: string } | { kind: 'server-error'; status: number };

            /**
             * The four shapes the Keen /auth/access_token envelope collapses to,
             * as a discriminated union so callers just switch on `kind`:
             *  - 'success'      → logged in; tokens are set as httpOnly cookies by
             *                     /api/login and never reach the client, so this
             *                     carries no payload — just "you're in, redirect".
             *  - 'otp'          → a PIN is required (confirm via /auth/otp/confirm).
             *  - 'rejected'     → the server answered and said no (bad credentials).
             *  - 'server-error' → 5xx / not ready / unreachable — reached but errored.
             */
            type Outcome = { kind: 'success' } | { kind: 'otp'; hash: string } | { kind: 'rejected'; message: string } | { kind: 'server-error'; status: number };

            /** Tokens returned on a direct (no-OTP) login. */
            interface Tokens {
                access_token: string;
                refresh_token: string;
                expires_in: number;
                token_type?: string;
            }

            /**
             * Returned when the login requires a second factor — message "Verify",
             * statusCode 201 — carrying the OTP `hash` the client confirms with.
             */
            interface Verify {
                hash: string;
            }

            /**
             * Raw /api/login reply, before it is classified into an Outcome. The
             * `result` is a union: `Tokens` on a direct login, `Verify` when an OTP
             * step is required, absent on a rejection / server error.
             */
            interface Envelope {
                success?: boolean;
                status?: number;
                statusCode?: number;
                message?: string;
                result?: Tokens | Verify;
                /**
                 * Set by /api/login (NOT sent by Keen upstream). true when the login
                 * completed and the tokens were stored as httpOnly cookies; false for
                 * the OTP "Verify" step or a rejection. Lets the client branch on one
                 * flag instead of sniffing the `result` shape.
                 */
                isToken?: boolean;
            }

            type HashObject = { hash: string; timestamp: number } | null;
        }
    }
}
