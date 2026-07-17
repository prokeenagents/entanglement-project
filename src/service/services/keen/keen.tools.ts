import { jwtVerify } from 'jose';
import KeenConnector from './keen.connector';
import { getAccessToken, getRefreshToken } from '@/utils/cookies';

export default class KeenTools {
    constructor(private KeenConnector: KeenConnector) {}

    /**
     * Verify a consumer access_token (an RS256 JWT signed by the partner's
     * certificate). Checks the signature against the cert public key AND that the
     * token is not expired (jwtVerify enforces `exp`). Returns true only when the
     * connector is active, the signature is valid, and the token is unexpired;
     * false otherwise.
     */
    async validateConsumerToken(accessToken: string): Promise<boolean> {
        try {
            if (!this.KeenConnector.isReady) {
                return false;
            }

            const publicKey = this.KeenConnector.publicKey;
            if (!publicKey) {
                return false;
            }

            const token = accessToken.replace(/^Bearer\s+/i, '').trim();
            if (!token) {
                return false;
            }

            await jwtVerify(token, publicKey, { algorithms: ['RS256'] });

            return true;
        } catch (err) {
            console.log(`[keen] ERROR: validateConsumerToken → ${(err as Error).message}`);
            return false;
        }
    }

    /**
     * Verify a consumer access_token AND return its logical payload — the
     * companion to validateConsumerToken (which only yields a boolean).
     *
     * Verifies the RS256 signature + expiry against the cert public key, then opens
     * the AES-sealed `hash` with this tenant's shared secret (purpose 'token') and
     * merges the recovered sensitive claims (sub / email / space / jti /
     * consumerContractKey) with the clear `origin` + `clientId`. Returns null when
     * the connector isn't ready, the signature/expiry fails, the token predates
     * sealing (no `hash`), or the secret can't open it (wrong key / tamper).
     *
     * Server-side only — the access token is an httpOnly cookie, so this lets the
     * Next server read the consumer's claims without a round-trip to Keen.
     */
    async getTokenPayload(accessToken: string): Promise<Keen.AccessTokenPayload | null> {
        try {
            if (!this.KeenConnector.isReady) {
                return null;
            }

            const publicKey = this.KeenConnector.publicKey;
            if (!publicKey) {
                return null;
            }

            const token = accessToken.replace(/^Bearer\s+/i, '').trim();
            if (!token) {
                return null;
            }

            // Signature + expiry (jwtVerify enforces `exp`). Matches
            // validateConsumerToken — algorithm only, no aud/iss check here.
            const { payload } = await jwtVerify(token, publicKey, { algorithms: ['RS256'] });

            const sealed = typeof payload.hash === 'string' ? payload.hash : '';
            if (!sealed) {
                return null;
            }

            // Open with the SAME per-cert secret + 'token' purpose ms-auth-consumer
            // sealed with. Throws on wrong key / tamper → caught → null.
            const inner = JSON.parse(this.KeenConnector.open(sealed, 'token')) as Partial<Keen.AccessTokenPayload>;

            return {
                sub: String(inner.sub ?? ''),
                username: String(inner.username ?? ''),
                email: String(inner.email ?? ''),
                space: String(inner.space ?? ''),
                jti: String(inner.jti ?? ''),
                consumerContractKey: String(inner.consumerContractKey ?? ''),
                origin: typeof payload.origin === 'string' ? payload.origin : '',
                clientId: typeof payload.clientId === 'string' ? payload.clientId : ''
            };
        } catch (err) {
            console.log(`[keen] ERROR: getTokenPayload → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Return only the spaces this consumer is entitled to — the cached full space
     * list intersected with the token's `space` claim. `tokenPayload.space` is a
     * pipe-delimited list of space IDs (`id1|id2|…`) baked into the access token by
     * ms-auth-consumer, so we split it and keep the cached spaces whose `id` matches.
     *
     * Reads the space list from the connector cache (server-only, populated over
     * NATS). Returns [] when there's no token, an empty claim, or an unloaded cache.
     */
    getConsumerSpaces(tokenPayload: Keen.AccessTokenPayload | null): Keen.SpaceListCacheResult[] {
        const cache = this.KeenConnector.cache.getSpaceList();
        const spaces = cache?.result ?? [];

        const allowed = tokenPayload?.space ? tokenPayload.space.split('|').filter(Boolean) : [];
        if (allowed.length === 0) {
            return [];
        }

        return spaces.filter(space => allowed.includes(space.id));
    }

    /**
     * One-shot consumer snapshot for the Next server: reads the session cookies,
     * decodes the access token, filters the cached space list to the token's `space`
     * claim, and flattens every agent across those entitled spaces. Server-only (the
     * tokens are httpOnly cookies + the cache is a server singleton). When there's no
     * session the tokens are undefined, tokenPayload is null, and the arrays are empty.
     */
    async getConsumerData(): Promise<Keen.ConsumerData> {
        const accessToken = await getAccessToken();
        const refreshToken = await getRefreshToken();

        const tokenPayload = accessToken ? await this.getTokenPayload(accessToken) : null;
        const consumerSpaces = this.getConsumerSpaces(tokenPayload);
        const agents = consumerSpaces.flatMap(space => space.agents ?? []);

        return { accessToken, refreshToken, tokenPayload, consumerSpaces, agents };
    }

    /**
     * Open the login OTP hash and return its contents. Unlike getTokenPayload this
     * is NOT a JWT — the OTP hash is a bare AES-GCM blob (`seal(..., 'otp')`), so
     * there is no signature to verify, just the symmetric open with this tenant's
     * shared secret + 'otp' purpose. Returns null when the connector isn't ready,
     * the blob can't be opened (wrong key / tamper), or the shape is unexpected.
     *
     * Optional in the flow — /api/otp forwards the hash to Keen, which validates it
     * on confirm. Use this only when the partner wants to read the email / expiry
     * itself (e.g. show "code sent to …" or pre-check expiry before the round-trip).
     */
    getOtpPayload(hash: string): Keen.OtpHashPayload | null {
        try {
            if (!this.KeenConnector.isReady) {
                return null;
            }

            // open() throws on a wrong key / tamper — caught below → null.
            const plaintext = this.KeenConnector.open(hash, 'otp');
            const parts = plaintext.split(':');
            if (parts.length !== 3) {
                return null;
            }

            const expireIn = Number(parts[2]);
            if (!Number.isFinite(expireIn)) {
                return null;
            }

            return { id: parts[0], email: parts[1], expireIn };
        } catch (err) {
            console.log(`[keen] ERROR: getOtpPayload → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Open + extract the registration claim payload from the verification link's
     * hash. The 10-field canonical is
     * `firstName|lastName|argon(password)|gender|consent|dob|email|contractKey|callbackSecret|expireIn`.
     *
     * The registration hash is now AES-256-GCM SEALED (purpose 'registration') with
     * this tenant's shared secret — opened, not RSA-verified. It carries the most PII
     * of any flow, so it must never be base64-decodable off the link. GCM's tag proves
     * authenticity; a wrong key / tamper throws → null. Returns null when the connector
     * isn't ready, the blob won't open, or the field count is wrong.
     */
    getRegistrationHashPayload(hash: string): Keen.RegistrationHashPayload | null {
        try {
            if (!this.KeenConnector.isReady) {
                return null;
            }

            const canonical = this.KeenConnector.open(hash, 'registration');
            const parts = canonical.split('|');
            if (parts.length !== 10) {
                return null;
            }

            const expireIn = Number(parts[9]);
            if (!Number.isFinite(expireIn)) {
                return null;
            }

            return {
                firstName: parts[0],
                lastName: parts[1],
                password: parts[2],
                gender: parts[3],
                consent: parts[4],
                dob: parts[5],
                email: parts[6],
                consumerContractKey: parts[7],
                callbackSecret: parts[8],
                expireIn
            };
        } catch (err) {
            console.log(`[keen] ERROR: getRegistrationHashPayload → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Open + extract the password-reset claim payload from the reset link's hash.
     * Covers both the logged-out reset and the logged-in auth-reset (identical
     * 5-field canonical `email|password|consumerContractKey|callbackSecret|expireIn`).
     *
     * Unlike registration/delete (still `base64url(canonical).sig`), the reset hash
     * is now AES-256-GCM SEALED with purpose 'reset-password' — so it's opened with
     * this tenant's shared secret, not RSA-verified. GCM's tag proves authenticity;
     * a wrong key / tamper throws → null. Returns null when the connector isn't
     * ready, the blob can't be opened, or the field count is wrong.
     */
    getResetPasswordHashPayload(hash: string): Keen.ResetPasswordHashPayload | null {
        try {
            if (!this.KeenConnector.isReady) {
                return null;
            }

            const canonical = this.KeenConnector.open(hash, 'reset-password');
            const parts = canonical.split('|');
            if (parts.length !== 5) {
                return null;
            }

            const expireIn = Number(parts[4]);
            if (!Number.isFinite(expireIn)) {
                return null;
            }

            return {
                email: parts[0],
                password: parts[1],
                consumerContractKey: parts[2],
                callbackSecret: parts[3],
                expireIn
            };
        } catch (err) {
            console.log(`[keen] ERROR: getResetPasswordHashPayload → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Verify + extract the account-deletion claim payload from an X-Hash. The
     * 4-field canonical is `email|consumerContractKey|callbackSecret|expireIn`.
     * Returns the parsed payload on a valid signature, else null.
     */
    async getDeleteHashPayload(hash: string): Promise<Keen.DeleteHashPayload | null> {
        const parts = await this.verifyHash(hash, 4);
        if (!parts) {
            return null;
        }

        const expireIn = Number(parts[3]);
        if (!Number.isFinite(expireIn)) {
            return null;
        }

        return {
            email: parts[0],
            consumerContractKey: parts[1],
            callbackSecret: parts[2],
            expireIn
        };
    }

    /**
     * Split an X-Hash (`base64url(canonical).base64url(sig)`), verify the
     * RSA-SHA256 signature over the canonical with the partner's certificate
     * public key (the jose-imported CryptoKey), and return the canonical's
     * pipe-split fields. Returns null when the key isn't ready, the format is
     * bad, the signature fails, or the field count doesn't match.
     */
    private async verifyHash(hash: string, expectedFields: number): Promise<string[] | null> {
        try {
            if (!this.KeenConnector.isReady) {
                return null;
            }

            const publicKey = this.KeenConnector.publicKey;
            if (!publicKey) {
                return null;
            }

            const dot = hash.indexOf('.');
            if (dot <= 0) {
                return null;
            }

            const canonical = Buffer.from(hash.slice(0, dot), 'base64url').toString('utf8');
            const signature = Buffer.from(hash.slice(dot + 1), 'base64url');
            const data = new TextEncoder().encode(canonical);

            const valid = await crypto.subtle.verify({ name: 'RSASSA-PKCS1-v1_5' }, publicKey, signature, data);
            if (!valid) {
                return null;
            }

            const parts = canonical.split('|');
            if (parts.length !== expectedFields) {
                return null;
            }

            return parts;
        } catch (err) {
            console.log(`[keen] ERROR: verifyHash → ${(err as Error).message}`);
            return null;
        }
    }
}
