export {};

declare global {
    namespace App {
        namespace User {
            /**
             * The editable profile fields — the subset `consumer.update` accepts.
             * Email + password are NOT here: email is the tenant identity, password
             * has its own reset flow. Day/month/year stay SEPARATE (Keen's update
             * takes them as three fields, unlike registration which folds them into
             * one `dob` string).
             */
            interface ProfileForm {
                firstName: string;
                lastName: string;
                /** '' = keep the current gender (blank means "leave unchanged"). */
                gender: '' | 'male' | 'female' | 'other';
                dobDay: string;
                dobMonth: string;
                dobYear: string;
            }

            /**
             * Flat result of POST /api/consumer/update — the route normalizes Keen's
             * two-token envelope (success carries `message`; error carries `error` +
             * `message[]`) into this one shape for the client.
             */
            interface ProfileUpdateReply {
                success: boolean;
                message?: string;
            }
        }
    }
}
