'use client';

import { useRouter } from 'next/navigation';

import { PAGE_CONFIG } from '@/configs/page.config';

import { API_CONFIG } from '@/configs/api.config';

/**
 * Keen types the `message` on its ERROR envelope as string[] (Nest validation
 * style) while its success envelope uses a plain string, and our own route adds a
 * third shape. Normalise to text so callers can render it without an array leaking
 * into the DOM. Returns null when there's nothing usable to show.
 */
const toMessage = (message: unknown): string | null => {
    if (Array.isArray(message)) {
        const joined = message.filter(entry => typeof entry === 'string').join(' ');
        return joined || null;
    }

    return typeof message === 'string' && message ? message : null;
};

export function useLogin() {
    const router = useRouter();

    return {
        /**
         * POST the credentials to our own /api/login route (server-side, drives the
         * Keen connector) and classify the reply into an App.Login.Outcome.
         */
        async login(data: App.Login.Form): Promise<App.Login.Outcome> {
            let res: Response;

            try {
                res = await fetch(API_CONFIG.LOGIN.URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: data.email,
                        password: data.password
                    }),
                    cache: 'no-store'
                });
            } catch (err) {
                // Couldn't even reach our own /api/login route.
                console.log(`[login] ERROR: ${(err as Error).message}`);
                return { kind: 'server-error', status: 0 };
            }

            // 5xx from our route == connector not ready / Keen unreachable / upstream error.
            if (res.status >= 500) {
                return { kind: 'server-error', status: res.status };
            }

            let envelope: App.Login.Envelope;

            try {
                envelope = JSON.parse(await res.text()) as App.Login.Envelope;
            } catch {
                return { kind: 'server-error', status: res.status };
            }

            const result = envelope.result;

            // isToken:true → /api/login stored the tokens as httpOnly cookies, so we're
            // logged in and there's nothing to read from the body.
            if (envelope.isToken === true) {
                return { kind: 'success' };
            }

            // Not a token but still success → the OTP "Verify" step; carry the hash
            // forward to the confirm flow.
            if (envelope.success === true && result && 'hash' in result) {
                return { kind: 'otp', hash: result.hash };
            }

            // success:false — split a genuine rejection (4xx) from an upstream 5xx envelope.
            if (typeof envelope.status === 'number' && envelope.status >= 500) {
                return { kind: 'server-error', status: envelope.status };
            }

            return { kind: 'rejected', message: envelope.message ?? 'Login failed.' };
        },

        /**
         * POST the reset claim to our own /api/reset-password route (server-side,
         * drives the Keen connector) and classify the reply into an
         * App.Login.ResetPasswordOutcome.
         *
         * `confirmPassword` IS sent even though Keen never sees it: the route
         * re-parses the whole @schema/reset-password schema, so the passwords-match
         * rule is enforced server-side rather than taken on trust from the browser.
         * Only { email, password } is forwarded upstream.
         *
         * A 'sent' outcome means Keen accepted the claim and emailed a link — the
         * password has NOT changed yet. It changes on the redeem leg, when the
         * consumer clicks through to /set-password.
         */
        async resetPassword(data: App.Login.ResetPasswordForm): Promise<App.Login.ResetPasswordOutcome> {
            let res: Response;

            try {
                res = await fetch(API_CONFIG.RESET_PASSWORD.URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        email: data.email,
                        password: data.password,
                        confirmPassword: data.confirmPassword
                    }),
                    cache: 'no-store'
                });
            } catch (err) {
                // Couldn't even reach our own /api/reset-password route.
                console.log(`[reset-password] ERROR: ${(err as Error).message}`);
                return { kind: 'server-error', status: 0 };
            }

            // 5xx from our route == connector not ready / Keen unreachable / upstream error.
            if (res.status >= 500) {
                return { kind: 'server-error', status: res.status };
            }

            let envelope: App.Login.Envelope;

            try {
                envelope = JSON.parse(await res.text()) as App.Login.Envelope;
            } catch {
                return { kind: 'server-error', status: res.status };
            }

            // No tokens ride this leg — the claim only ever reports "mail on its way",
            // so success is the whole story and there's nothing to read from the body.
            if (envelope.success === true) {
                return { kind: 'sent' };
            }

            // success:false — split a genuine refusal (4xx) from an upstream 5xx envelope.
            if (typeof envelope.status === 'number' && envelope.status >= 500) {
                return { kind: 'server-error', status: envelope.status };
            }

            return { kind: 'rejected', message: toMessage(envelope.message) ?? 'Password reset failed.' };
        },

        /**
         * POST the outside-registration claim to /api/registration and classify the
         * reply into an App.Registration.Outcome. `confirmPassword` IS sent so the
         * route re-parses the whole schema (passwords match + consent) server-side.
         *
         * A 'sent' outcome means Keen accepted the claim and emailed a verification
         * link — the account does NOT exist yet; it's created on the redeem leg when
         * the consumer clicks through.
         */
        async registration(data: App.Registration.WirePayload): Promise<App.Registration.Outcome> {
            let res: Response;

            try {
                res = await fetch(API_CONFIG.REGISTRATION.URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data),
                    cache: 'no-store'
                });
            } catch (err) {
                // Couldn't even reach our own /api/registration route.
                console.log(`[registration] ERROR: ${(err as Error).message}`);
                return { kind: 'server-error', status: 0 };
            }

            // 5xx from our route == connector not ready / Keen unreachable / upstream error.
            if (res.status >= 500) {
                return { kind: 'server-error', status: res.status };
            }

            let envelope: App.Login.Envelope;

            try {
                envelope = JSON.parse(await res.text()) as App.Login.Envelope;
            } catch {
                return { kind: 'server-error', status: res.status };
            }

            // No tokens ride this leg — the claim only reports "mail on its way".
            if (envelope.success === true) {
                return { kind: 'sent' };
            }

            if (typeof envelope.status === 'number' && envelope.status >= 500) {
                return { kind: 'server-error', status: envelope.status };
            }

            return { kind: 'rejected', message: toMessage(envelope.message) ?? 'Registration failed.' };
        },

        /**
         * Clear the session cookies server-side (httpOnly — the browser can't touch
         * them itself) then send the user back to the login page.
         */
        async logout(): Promise<void> {
            try {
                await fetch(API_CONFIG.LOGOUT.URL, { method: 'POST', cache: 'no-store' });
            } catch (err) {
                console.log(`[logout] ERROR: ${(err as Error).message}`);
            }

            router.replace(PAGE_CONFIG.LOGIN.URL);
            router.refresh();
        },

        /**
         * POST the credentials to our own /api/otp route (server-side, drives the
         * Keen connector) and classify the reply into an App.Login.Outcome.
         */
        async otp(
            data: App.Login.Otp<{
                hash: string;
            }>
        ): Promise<App.Login.Outcome> {
            let res: Response;

            try {
                res = await fetch(API_CONFIG.OTP.URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        pin: data.pin,
                        token: data.hash
                    }),
                    cache: 'no-store'
                });
            } catch (err) {
                // Couldn't even reach our own /api/otp route.
                console.log(`[otp] ERROR: ${(err as Error).message}`);
                return { kind: 'server-error', status: 0 };
            }

            // 5xx from our route == connector not ready / Keen unreachable / upstream error.
            if (res.status >= 500) {
                return { kind: 'server-error', status: res.status };
            }

            let envelope: App.Login.Envelope;

            try {
                envelope = JSON.parse(await res.text()) as App.Login.Envelope;
            } catch {
                return { kind: 'server-error', status: res.status };
            }

            // isToken:true → /api/login stored the tokens as httpOnly cookies, so we're
            // logged in and there's nothing to read from the body.
            if (envelope.isToken === true) {
                return { kind: 'success' };
            }

            // success:false — split a genuine rejection (4xx) from an upstream 5xx envelope.
            if (typeof envelope.status === 'number' && envelope.status >= 500) {
                return { kind: 'server-error', status: envelope.status };
            }

            return { kind: 'rejected', message: envelope.message ?? 'Login failed.' };
        }
    };
}
