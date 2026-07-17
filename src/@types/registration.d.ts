export {};

declare global {
    namespace App {
        namespace Registration {
            /**
             * The outside-registration FORM shape. `password` is the NEW account
             * password, baked into the emailed hash at claim time (like reset-password).
             * `consent` is a boolean while filling; the schema requires it be true.
             * Date of birth is three separate selects (day/month/year); the form
             * combines them into the wire `dob` before posting.
             */
            interface Form {
                firstName: string;
                lastName: string;
                email: string;
                password: string;
                confirmPassword: string;
                gender: 'male' | 'female' | 'other';
                dobDay: string;
                dobMonth: string;
                dobYear: string;
                consent: boolean;
            }

            /** What /api/registration receives — the form with day/month/year folded
             * into a single "YYYY-MM-DD" `dob`. */
            type WirePayload = Omit<Form, 'dobDay' | 'dobMonth' | 'dobYear'> & { dob: string };

            /**
             * The shapes /api/registration collapses to, as a discriminated union so
             * callers just switch on `kind`:
             *  - 'sent'         → Keen accepted the claim and emailed the verification
             *                     link. No account exists yet — it's created when the
             *                     consumer clicks through and the redeem leg runs.
             *  - 'rejected'     → the server answered and said no (e.g. email in use).
             *  - 'server-error' → 5xx / not ready / unreachable — reached but errored.
             */
            type Outcome = { kind: 'sent' } | { kind: 'rejected'; message: string } | { kind: 'server-error'; status: number };
        }
    }
}
