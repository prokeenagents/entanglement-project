import { importX509 } from 'jose';
import KeenConsumer from './keen.consumer';
import KeenResources from './keen.resources';
import KeenExternal from './keen.external';
import KeenTools from './keen.tools';
import KeenCache from './keen.cache';
import KeenFrontSettings from './keen.front-settings';
import { seal as sealPayload, open as openPayload } from './keen.crypto';

export default class KeenConnector {
    private active: boolean = false;
    private connecting: boolean = false;
    private authorization: string = '';
    private applicationToken: string = '';
    private claimCertificateCode: string = '';
    private redeemedCertificateCode: boolean = false;
    private keenCertificate: string = '';
    private keenSecretKey: string = '';
    private joseKey: CryptoKey | null = null;

    /**
     * Namespaces
     */
    private Consumer: KeenConsumer;
    private Resources: KeenResources;
    private External: KeenExternal;
    private Tools: KeenTools;
    private Cache: KeenCache;
    private FrontSettings: KeenFrontSettings;

    constructor(private PROPS: Keen.Connector) {
        this.authorization = this.getAuthorization();
        this.Consumer = new KeenConsumer(this);
        this.Resources = new KeenResources(this);
        this.External = new KeenExternal(this);
        this.Tools = new KeenTools(this);
        this.Cache = new KeenCache(this);
        this.FrontSettings = new KeenFrontSettings(this);
    }

    /** The application_token fetched at boot. Empty string until getApplicationToken succeeds. */
    get token(): string {
        return this.applicationToken;
    }

    get props() {
        return this.PROPS;
    }
    /** True once a token has been fetched successfully. */
    get isReady(): boolean {
        return this.active;
    }

    get cache(): KeenCache {
        return this.Cache;
    }

    get certificate(): string {
        return this.keenCertificate;
    }

    /**
     * The shared symmetric key delivered alongside the PEM by the r_cert redeem.
     * '' when the admin never set one — callers must treat that as "no symmetric
     * channel available" rather than deriving a key from an empty string.
     */
    get secretKey(): string {
        return this.keenSecretKey;
    }

    /**
     * AES-256-GCM seal a string with THIS tenant's shared secret. The same key +
     * algorithm Keen uses, so a payload sealed here opens on the Keen side (and
     * vice versa). `purpose` must match the far side ('token' | 'otp').
     *
     * NOTE: when `keenSecretKey` is '' (no secret provisioned) this falls back to a
     * fixed weak default — obfuscation, not confidentiality. Gate real secrets on
     * `secretKey` being non-empty if that matters to the caller.
     */
    seal(plaintext: string, purpose: string = 'token'): string {
        return sealPayload(plaintext, this.keenSecretKey, purpose);
    }

    /**
     * Reverse of `seal`. Throws on a wrong key / wrong purpose / tampering, so the
     * caller MUST treat a throw as "reject", never trust a partial decode.
     */
    open(blob: string, purpose: string = 'token'): string {
        return openPayload(blob, this.keenSecretKey, purpose);
    }

    get publicKey(): CryptoKey | null {
        return this.joseKey;
    }

    get consumer(): KeenConsumer {
        return this.Consumer;
    }

    get tools(): KeenTools {
        return this.Tools;
    }

    get resources(): KeenResources {
        return this.Resources;
    }

    /** Value-level Front Settings reads — the partner-side mirror of system/settings (get / getMany / has). */
    get frontSettings(): KeenFrontSettings {
        return this.FrontSettings;
    }

    get external(): KeenExternal {
        return this.External;
    }

    getApplicationToken() {
        return this.applicationToken;
    }

    /**
     * Mark the connector active / inactive. Set false when the upstream contract
     * is removed (r_consumer_policy_delete) so isReady gates every resource call
     * until the next reconnect.
     */
    setActive(active: boolean) {
        this.active = active;
    }

    /**
     * Store both halves the r_cert redeem delivers. `secretKey` is the shared
     * symmetric key and defaults to '' — an admin may leave it unset, and the
     * r_cert_delete path clears the certificate by calling this with no arguments.
     */
    async setCertificate(cert: string, secretKey: string = '') {
        this.keenCertificate = cert;
        this.keenSecretKey = secretKey;
        await this.createJoseInstance();
    }

    /**
     * Imports the X.509 certificate received from Keen as an RS256 public key,
     * usable to verify JWTs signed by the partner's bound certificate. Caches the
     * imported key on the instance and returns it; returns null when no
     * certificate has been received yet.
     */
    private async createJoseInstance(): Promise<CryptoKey | null> {
        try {
            if (!this.keenCertificate) {
                return null;
            }

            const publicKey = await importX509(this.keenCertificate, 'RS256');

            this.joseKey = publicKey;

            console.log('[OK] Certificate received.');

            return publicKey;
        } catch (err) {
            console.log(`[ERROR] Error: ${(err as Error).message}`);
            this.joseKey = null;
            return null;
        }
    }

    /**
     * Acquire the application_token, retrying every 2s forever until it succeeds.
     * Idempotent: no-op if a token is already held, and won't start a second loop
     * if one is already running.
     */
    async connect(): Promise<void> {
        await this.applicationTokenRetrier();
        await this.fetchCertificateRetrier();

        await this.tryActivate(async () => {
            await this.resources.getConsumerContract();
            await this.resources.getConsumerPolicy();
            await this.resources.getSpaceList();
            await this.resources.getConsumerContract();
        });
    }

    private resetProps() {
        this.active = false;
        this.connecting = false;
        this.claimCertificateCode = '';
        this.redeemedCertificateCode = false;
        this.keenCertificate = '';
        this.keenSecretKey = '';
        this.joseKey = null;
    }

    async reconnect(): Promise<void> {
        this.resetProps();
        await this.connect();
    }

    private async tryActivate(callback?: () => Promise<void>) {
        try {
            let attempt = 0;
            while (!this.keenCertificate || !this.applicationToken) {
                attempt++;
                console.log(`[BOOT] Application activated: FALSE. Retrying in 2s. (attempt ${attempt})`);
                await this.delay(2000);
            }
        } finally {
            this.active = true;
            if (callback) {
                await callback();
            }
        }

        console.log(`[BOOT] Application activated: ${this.active}`);
    }

    async fetchApplicationToken() {
        const url = this.getApplicationTokenHostUrl();

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    Origin: this.PROPS.ORIGIN,
                    Authorization: this.authorization
                },
                cache: 'no-store'
            });

            const text = await res.text();
            let data: unknown = text;

            try {
                data = JSON.parse(text);
            } catch {
                return false;
            }

            console.log(`[BOOT] application_token → HTTP ${res.status}`);

            if (!res.ok) {
                return false;
            }

            const obj = (typeof data === 'object' && !!data ? data : {}) as {
                success: true;
                status: number;
                message: string;
                result: {
                    type: string;
                    access_token: string;
                };
            };

            const token = !!obj.result && obj.result.access_token ? obj.result.access_token : '';

            this.applicationToken = typeof token === 'string' ? token : '';

            return true;
        } catch (err) {
            console.error('[BOOT] application_token failed:', err instanceof Error ? err.message : err);
            return false;
        }
    }

    private async applicationTokenRetrier() {
        if (this.connecting) {
            return;
        }
        this.connecting = true;

        try {
            let attempt = 0;
            while (!this.applicationToken) {
                attempt++;
                const ok = await this.fetchApplicationToken();
                if (ok) {
                    console.log(`[keen] application_token acquired (attempt ${attempt})`);
                    return;
                }
                console.warn(`[keen] application_token attempt ${attempt} failed — retrying in 2s`);
                await this.delay(2000);
            }
        } finally {
            this.connecting = false;
        }
    }

    private getAuthorization() {
        const raw = [this.PROPS.CLIENT_SECRET, this.PROPS.API_KEY_ID, this.PROPS.API_KEY_SECRET].join('|');
        return Buffer.from(raw, 'utf8').toString('base64');
    }

    private getApplicationTokenHostUrl() {
        return `${this.PROPS.KEEN_HOST}/keen-api/auth/application_token?client_id=${encodeURIComponent(this.PROPS.CLIENT_ID)}`;
    }

    private getClaimCertificateUrl() {
        return `${this.PROPS.KEEN_HOST}/keen-api/resources/certificate?client_id=${encodeURIComponent(this.PROPS.CLIENT_ID)}`;
    }

    private getRedeemCertificateUrl() {
        return `${this.PROPS.KEEN_HOST}/keen-api/resources/certificate?client_id=${encodeURIComponent(this.PROPS.CLIENT_ID)}`;
    }

    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Two-phase certificate handshake, each phase retrying every 2s until it
     * lands: first claim a single-use code, then redeem it. The certificate
     * itself is not returned here — it arrives asynchronously at the webhook
     * route, which calls setCertificate().
     */
    async fetchCertificateRetrier() {
        if (!this.applicationToken) {
            return;
        }

        console.log(`[keen] Application token is acquired. Fetching Certificate...`);

        let attempt = 0;

        while (!this.claimCertificateCode) {
            attempt++;
            const ok = await this.claimCertificate();

            if (ok) {
                console.log(`[keen] Claim Certificate Code acquired (attempt ${attempt})`);
                break;
            }

            console.warn(`[keen] Claim Certificate Code attempt ${attempt} failed — retrying in 2s`);

            await this.delay(2000);
        }

        console.log(`[keen] Certificate code fetched. Requesting certificate.`);

        attempt = 0;

        while (!this.redeemedCertificateCode) {
            attempt++;
            const ok = await this.redeemCertificate();

            if (ok) {
                console.log(`[keen] Redeem Certificate (attempt ${attempt})`);
                break;
            }

            console.warn(`[keen] >Redeem Certificate ${attempt} failed — retrying in 2s`);

            await this.delay(2000);
        }
    }

    private async claimCertificate() {
        try {
            const headers = new Headers();
            headers.append('Authorization', `Bearer ${this.getApplicationToken()}`);
            headers.append('Origin', this.PROPS.ORIGIN);
            headers.append('Content-Type', 'application/json');

            const url = this.getClaimCertificateUrl();

            const result = await fetch(url, {
                method: 'GET',
                headers,
                redirect: 'follow',
                cache: 'no-store'
            });

            const text = await result.text();
            let data: unknown = text;

            try {
                data = JSON.parse(text);
            } catch {
                return false;
            }

            console.log(`[BOOT] Certificate claim → HTTP ${result.status}`);

            if (!result.ok) {
                return false;
            }

            if (!data || typeof data !== 'object' || !('result' in data)) {
                return false;
            }

            const obj = data as {
                result: {
                    code: string;
                };
            };

            this.claimCertificateCode = obj.result.code;

            return true;
        } catch (err) {
            console.error('[BOOT] Certificate claim failed:', err instanceof Error ? err.message : err);
            return false;
        }
    }

    async redeemCertificate() {
        try {
            const headers = new Headers();

            headers.append('Authorization', `Bearer ${this.getApplicationToken()}`);
            headers.append('Origin', this.PROPS.ORIGIN);
            headers.append('Content-Type', 'application/json');

            const url = this.getRedeemCertificateUrl();

            const raw = JSON.stringify({
                code: this.claimCertificateCode
            });

            const result = await fetch(url, {
                method: 'POST',
                headers,
                redirect: 'follow',
                cache: 'no-store',
                body: raw
            });

            const text = await result.text();
            let data: unknown = text;

            try {
                data = JSON.parse(text);
            } catch {
                return false;
            }

            console.log(`[BOOT] Certificate redeem → HTTP ${result.status}`, data);

            if (!result.ok) {
                this.redeemedCertificateCode = false;
                return false;
            }

            this.redeemedCertificateCode = true;

            return true;
        } catch (err) {
            console.error('[BOOT] Certificate redeem failed:', err instanceof Error ? err.message : err);
            return false;
        }
    }
}
