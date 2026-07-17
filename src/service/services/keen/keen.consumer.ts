import KeenConnector from './keen.connector';
import KeenValidator from './keen.validator';

export default class KeenConsumer {
    constructor(private KeenConnector: KeenConnector) {}

    /**
     * Consumer login. POSTs { email, password } to /keen-api/auth/access_token
     * and returns the parsed envelope (tokens on success, or the error
     * envelope). Returns null when not connected or on a transport error.
     */
    async getAccessToken(body: Keen.ConsumerAccessTokenBody): Promise<Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | null> {
        const resourceName = 'Consumer Access Token';
        const path = '/keen-api/auth/access_token';

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
     * Rotate the consumer session. POSTs the refresh token to
     * /keen-api/auth/refresh_token and returns the parsed envelope. Returns
     * null when not connected or on a transport error.
     */
    async rotateToken(body: Keen.ConsumerRotateTokenBody): Promise<Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | Keen.ConsumerRotateToken | null> {
        const resourceName = 'Consumer Refresh Token';
        const path = '/keen-api/auth/refresh_token';

        try {
            KeenValidator.validateToken(body.token);
            KeenValidator.validateToken(body.refreshToken);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${body.token}`);

            const raw = JSON.stringify({
                refresh_token: `Bearer ${body.refreshToken}`,
                type: 'refresh'
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

            return data as Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | Keen.ConsumerRotateToken;
        } catch (err) {
            console.log(`[keen] ERROR: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Confirm an OTP pin. POSTs { pin, token } to /keen-api/auth/otp/confirm and
     * returns the parsed envelope. Returns null when not connected or on error.
     */
    async sendOtp(body: Keen.ConsumerOTPBody): Promise<Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | null> {
        const resourceName = 'Consumer OTP';
        const path = '/keen-api/auth/otp/confirm';

        try {
            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');

            const raw = JSON.stringify({
                pin: `${body.pin}`,
                token: `${body.token}`
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
     * First leg of the authenticated password change (two-token call:
     * application_token + X-Access-Token). POSTs { email, password } — the new
     * password plus the logged-in user's own email — to
     * /keen-api/consumer/auth-reset-password-claim. The relay emails a confirm
     * link to X-Callback-Url (required); nothing is applied yet. Returns the
     * parsed envelope, or null when not connected / on error.
     */
    async resetPasswordClaim(body: Keen.ConsumerResetPasswordClaimBody): Promise<Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | null> {
        const resourceName = 'Consumer Reset Password Claim';
        const path = '/keen-api/consumer/auth-reset-password-claim';

        try {
            KeenValidator.validateEmail(body.email);
            KeenValidator.validatePassword(body.password);
            KeenValidator.validateToken(body.accessToken);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Access-Token', body.accessToken);
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
     * Second leg of the authenticated password change. Applies the new password
     * using the X-Hash + X-Callback-Secret carried by the consumer's confirm
     * link. Two-token call; client_id is sent as a query param and must match
     * the application_token. No request body. X-Callback-Url here is the
     * optional completion ping. Returns the parsed envelope, or null when not
     * connected / on error.
     */
    async resetPasswordRedeem(body: Keen.ConsumerResetPasswordRedeemBody): Promise<Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | null> {
        const resourceName = 'Consumer Reset Password Redeem';
        const clientId = encodeURIComponent(this.KeenConnector.props.CLIENT_ID);
        const path = `/keen-api/consumer/auth-reset-password-redeem?client_id=${clientId}`;

        try {
            KeenValidator.validateToken(body.accessToken);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Access-Token', body.accessToken);
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
     * First leg of authenticated account deletion (two-token call:
     * application_token + X-Access-Token). The target is the access token's OWN
     * account, so there is no request body. POSTs to
     * /keen-api/consumer/delete-claim; the relay emails a confirm link to
     * X-Callback-Url (required). Nothing is deleted yet. Returns the parsed
     * envelope, or null when not connected / on error.
     */
    async deleteClaim(body: Keen.ConsumerDeleteClaimBody): Promise<Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | null> {
        const resourceName = 'Consumer Delete Claim';
        const path = '/keen-api/consumer/delete-claim';

        try {
            KeenValidator.validateToken(body.accessToken);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Access-Token', body.accessToken);
            headers.append('X-Callback-Url', body.callbackUrl);

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
     * Second leg of authenticated account deletion — this is the one that
     * actually deletes. Uses the X-Hash + X-Callback-Secret carried by the
     * consumer's confirm link. Two-token call; client_id is sent as a query
     * param and must match the application_token. No request body. X-Callback-Url
     * here is the optional completion ping. Returns the parsed envelope, or null
     * when not connected / on error.
     */
    async deleteRedeem(body: Keen.ConsumerDeleteRedeemBody): Promise<Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | null> {
        const resourceName = 'Consumer Delete Redeem';
        const clientId = encodeURIComponent(this.KeenConnector.props.CLIENT_ID);
        const path = `/keen-api/consumer/delete-redeem?client_id=${clientId}`;

        try {
            KeenValidator.validateToken(body.accessToken);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Access-Token', body.accessToken);
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
     * Partial profile update for the logged-in consumer. Two-token call
     * (application_token + X-Access-Token). Sends only the supplied profile
     * fields; returns the parsed envelope, or null when not connected / on error.
     */
    async update(body: Keen.ConsumerUpdateBody): Promise<Keen.ConsumerAccessToken | Keen.ConsumerAccessTokenError | null> {
        const resourceName = 'Consumer Update';
        const path = '/keen-api/consumer/update';

        try {
            KeenValidator.validateToken(body.accessToken);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            /**
             * Collect only the supplied profile fields (partial update).
             */
            const fields: Record<string, string> = {};

            for (const key of ['firstName', 'lastName', 'gender', 'dobDay', 'dobMonth', 'dobYear'] as const) {
                const value = body[key];

                if (typeof value === 'string' && value.trim().length > 0) {
                    fields[key] = value;
                }
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Access-Token', body.accessToken);

            if (body.callbackUrl) {
                headers.append('X-Callback-Url', body.callbackUrl);
            }

            const requestOptions = {
                method: 'POST',
                headers: headers,
                redirect: 'follow',
                body: JSON.stringify(fields)
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
     * List the logged-in consumer's active chats. Two-token call. Returns the
     * parsed chat envelope, or null when not connected / on error.
     */
    async getChatList(body: Keen.ConsumerChatListBody): Promise<Keen.ConsumerChatReply | null> {
        const resourceName = 'Consumer Chat List';
        const path = '/keen-api/consumer/chat-list';

        try {
            KeenValidator.validateToken(body.accessToken);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Access-Token', body.accessToken);

            const requestOptions = {
                method: 'GET',
                headers: headers,
                redirect: 'follow'
            } as RequestInit;

            const result = await fetch(url, requestOptions);
            const text = await result.text();
            const data: unknown = JSON.parse(text);

            console.log(`[keen] ${resourceName} → HTTP ${result.status}`);

            return data as Keen.ConsumerChatReply;
        } catch (err) {
            console.log(`[keen] ERROR: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Case-insensitive substring search over the consumer's active chat titles.
     * Two-token call; `query` is required, `limit` defaults to 150 server-side.
     * Returns the parsed chat envelope, or null when not connected / on error.
     */
    async searchChats(body: Keen.ConsumerChatSearchBody): Promise<Keen.ConsumerChatReply | null> {
        const resourceName = 'Consumer Chat Search';

        try {
            KeenValidator.validateToken(body.accessToken);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            const query = encodeURIComponent(body.query);
            const limit = body.limit ?? 150;
            const path = `/keen-api/consumer/chat/search?q=${query}&limit=${limit}`;
            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Access-Token', body.accessToken);

            const requestOptions = {
                method: 'GET',
                headers: headers,
                redirect: 'follow'
            } as RequestInit;

            const result = await fetch(url, requestOptions);
            const text = await result.text();
            const data: unknown = JSON.parse(text);

            console.log(`[keen] ${resourceName} → HTTP ${result.status}`);

            return data as Keen.ConsumerChatReply;
        } catch (err) {
            console.log(`[keen] ERROR: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Fetch one chat's message history (newest first, cursor-paginated). Two-token
     * call; `limit` defaults to 50 server-side and `before` is a `<createdAt>:<id>`
     * cursor. Returns the parsed chat envelope, or null when not connected / on error.
     */
    async getChatHistory(body: Keen.ConsumerChatHistoryBody): Promise<Keen.ConsumerChatReply | null> {
        const resourceName = 'Consumer Chat History';

        try {
            KeenValidator.validateToken(body.accessToken);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            const chatId = encodeURIComponent(body.chatId);
            const limit = body.limit ?? 50;
            const before = body.before ? `&before=${encodeURIComponent(body.before)}` : '';
            const path = `/keen-api/consumer/chat/${chatId}/history?limit=${limit}${before}`;
            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Access-Token', body.accessToken);

            const requestOptions = {
                method: 'GET',
                headers: headers,
                redirect: 'follow'
            } as RequestInit;

            const result = await fetch(url, requestOptions);
            const text = await result.text();
            const data: unknown = JSON.parse(text);

            console.log(`[keen] ${resourceName} → HTTP ${result.status}`);

            return data as Keen.ConsumerChatReply;
        } catch (err) {
            console.log(`[keen] ERROR: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Rename a chat (owner-scoped to the X-Access-Token's user). Two-token call.
     * POSTs { title } to /keen-api/consumer/chat/:id/title. Returns the parsed
     * chat envelope, or null when not connected / on error.
     */
    async setChatTitle(body: Keen.ConsumerSetChatTitleBody): Promise<Keen.ConsumerChatReply | null> {
        const resourceName = 'Consumer Set Chat Title';

        try {
            KeenValidator.validateToken(body.accessToken);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            const chatId = encodeURIComponent(body.chatId);
            const path = `/keen-api/consumer/chat/${chatId}/title`;
            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Access-Token', body.accessToken);

            const raw = JSON.stringify({
                title: body.title
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

            return data as Keen.ConsumerChatReply;
        } catch (err) {
            console.log(`[keen] ERROR: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Soft-delete (archive) a chat (owner-scoped). Two-token call; no request
     * body. The chat then vanishes from list/history. Returns the parsed chat
     * envelope, or null when not connected / on error.
     */
    async deleteChat(body: Keen.ConsumerDeleteChatBody): Promise<Keen.ConsumerChatReply | null> {
        const resourceName = 'Consumer Delete Chat';

        try {
            KeenValidator.validateToken(body.accessToken);

            if (!this.KeenConnector.isReady) {
                return null;
            }

            const chatId = encodeURIComponent(body.chatId);
            const path = `/keen-api/consumer/chat/${chatId}/delete`;
            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');
            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('X-Access-Token', body.accessToken);

            const requestOptions = {
                method: 'POST',
                headers: headers,
                redirect: 'follow'
            } as RequestInit;

            const result = await fetch(url, requestOptions);
            const text = await result.text();
            const data: unknown = JSON.parse(text);

            console.log(`[keen] ${resourceName} → HTTP ${result.status}`);

            return data as Keen.ConsumerChatReply;
        } catch (err) {
            console.log(`[keen] ERROR: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }
}
