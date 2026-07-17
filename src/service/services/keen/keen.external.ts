import KeenConnector from './keen.connector';
import KeenValidator from './keen.validator';

export default class KeenExternal {
    constructor(private KeenConnector: KeenConnector) {}

    /**
     * First leg of LOGGED-OUT external registration (application-token only — no
     * X-Access-Token). POSTs the new consumer's details to
     * /keen-api/consumer/registration-claim; the relay emails a verification
     * link to X-Callback-Url (required). Nothing is created yet. Returns the
     * parsed envelope, or null when not connected / on error.
     */
    async registrationClaim(body: Keen.ExternalRegistrationClaimBody): Promise<Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | null> {
        const resourceName = 'External Registration Claim';
        const path = '/keen-api/consumer/registration-claim';

        try {
            KeenValidator.validateEmail(body.email);
            KeenValidator.validatePassword(body.password);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Callback-Url', body.callbackUrl);

            const raw = JSON.stringify({
                firstName: body.firstName,
                lastName: body.lastName,
                password: body.password,
                gender: body.gender,
                consent: body.consent,
                dob: body.dob,
                email: body.email
            });

            const requestOptions = {
                method: 'POST',
                headers: headers,
                redirect: 'follow',
                body: raw
            } as RequestInit;

            const result = await fetch(url, requestOptions);
            const text = await result.text();
            const data: unknown = JSON.parse(text);

            console.log(`[keen] ${resourceName} → HTTP ${result.status}`);

            return data as Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError;
        } catch (err) {
            console.log(`[keen] ERROR: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Second leg of LOGGED-OUT external registration — creates the account using
     * the X-Hash + X-Callback-Secret carried by the consumer's verification
     * link. Application-token only; client_id is sent as a query param and must
     * match the application_token. No request body. X-Callback-Url here is the
     * optional completion ping. Returns the parsed envelope, or null when not
     * connected / on error.
     */
    async registrationRedeem(body: Keen.ExternalRegistrationRedeemBody): Promise<Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | null> {
        const resourceName = 'External Registration Redeem';
        const clientId = encodeURIComponent(this.KeenConnector.props.CLIENT_ID);
        const path = `/keen-api/consumer/registration-redeem?client_id=${clientId}`;

        try {
            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Hash', body.hash);
            headers.append('X-Callback-Secret', body.callbackSecret);

            if (body.callbackUrl) {
                headers.append('X-Callback-Url', body.callbackUrl);
            }

            const requestOptions = {
                method: 'POST',
                headers: headers,
                redirect: 'follow'
            } as RequestInit;

            const result = await fetch(url, requestOptions);
            const text = await result.text();
            const data: unknown = JSON.parse(text);

            console.log(`[keen] ${resourceName} → HTTP ${result.status}`);

            return data as Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError;
        } catch (err) {
            console.log(`[keen] ERROR: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * First leg of LOGGED-OUT password reset ("forgot password", application-token
     * only). POSTs { email, password } (the new password) to
     * /keen-api/consumer/reset-password-claim; the relay emails a reset link to
     * X-Callback-Url (required). Nothing is applied yet. Returns the parsed
     * envelope, or null when not connected / on error.
     */
    async resetPasswordClaim(body: Keen.ExternalResetPasswordClaimBody): Promise<Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | null> {
        const resourceName = 'External Reset Password Claim';
        const path = '/keen-api/consumer/reset-password-claim';

        try {
            KeenValidator.validateEmail(body.email);
            KeenValidator.validatePassword(body.password);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Callback-Url', body.callbackUrl);

            const raw = JSON.stringify({
                email: body.email,
                password: body.password
            });

            const requestOptions = {
                method: 'POST',
                headers: headers,
                redirect: 'follow',
                body: raw
            } as RequestInit;

            const result = await fetch(url, requestOptions);
            const text = await result.text();
            const data: unknown = JSON.parse(text);

            console.log(`[keen] ${resourceName} → HTTP ${result.status}`);

            return data as Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError;
        } catch (err) {
            console.log(`[keen] ERROR: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Second leg of LOGGED-OUT password reset — applies the new password using
     * the X-Hash + X-Callback-Secret carried by the consumer's reset link.
     * Application-token only; client_id is sent as a query param and must match
     * the application_token. No request body. X-Callback-Url here is the optional
     * completion ping. Returns the parsed envelope, or null when not connected /
     * on error.
     */
    async resetPasswordRedeem(body: Keen.ExternalResetPasswordRedeemBody): Promise<Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | null> {
        const resourceName = 'External Reset Password Redeem';
        const clientId = encodeURIComponent(this.KeenConnector.props.CLIENT_ID);
        const path = `/keen-api/consumer/reset-password-redeem?client_id=${clientId}`;

        try {
            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Hash', body.hash);
            headers.append('X-Callback-Secret', body.callbackSecret);

            if (body.callbackUrl) {
                headers.append('X-Callback-Url', body.callbackUrl);
            }

            const requestOptions = {
                method: 'POST',
                headers: headers,
                redirect: 'follow'
            } as RequestInit;

            const result = await fetch(url, requestOptions);
            const text = await result.text();
            const data: unknown = JSON.parse(text);

            console.log(`[keen] ${resourceName} → HTTP ${result.status}`);

            return data as Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError;
        } catch (err) {
            console.log(`[keen] ERROR: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }
}
