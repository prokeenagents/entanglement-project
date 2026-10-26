import { importX509 } from 'jose';
import KeenConsumer from './keen.consumer';
import KeenResources from './keen.resources';
import KeenExternal from './keen.external';
import KeenTools from './keen.tools';
import KeenCache from './keen.cache';
import KeenFrontSettings from './keen.front-settings';
import { seal as sealPayload, open as openPayload } from './keen.crypto';

/** tryActivate polls every 2s; this many polls without a certificate (≈16s) → redeem again. */
const CERTIFICATE_REDEEM_EVERY_ATTEMPTS = 8;

/** How long after a certificate redeem the webhook may deliver the r_cert material. */
const CERTIFICATE_WINDOW_MS = 60_000;

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
    private activated: boolean = false;
    private certificateWaiter: (() => void) | null = null;
    /** Epoch ms until which r_cert material from the webhook is accepted (0 = not expecting any). */
    private certificateExpectedUntil: number = 0;

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

    /**
     * True once the boot sequence has finished — token, certificate AND the first
     * contract / policy / space-list reads. `isReady` turns true BEFORE those reads
     * (they are gated on it), so a page rendered in between would see an empty space
     * list; the proxy waits for this instead (utils/demo.ts). A WAKE reconnect keeps it:
     * the current certificate stays in use until the new one lands.
     */
    get isActivated(): boolean {
        return this.activated;
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
     * Throws when no secret is provisioned — there is no weak default to fall back on.
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
     * Store both halves the r_cert redeem delivers. The r_cert_delete path clears
     * the certificate by calling this with no arguments.
     *
     * A certificate WITHOUT a shared secret is refused. Keen falls back to a fixed,
     * public default key when the admin leaves the secret empty, so every sealed
     * session, OTP and registration hash (argon password included) would open for
     * anyone. Better to stay in maintenance and say why than to run on that.
     */
    async setCertificate(cert: string = '', secretKey: string = '') {
        if (cert && !secretKey) {
            console.error(
                '[keen] Certificate REFUSED: it has no shared secret key. In the Keen admin open API Keys → Certificates, Generate a secret key on this certificate, then press Wake on the api key.'
            );
            cert = '';
        }

        this.keenCertificate = cert;
        this.keenSecretKey = cert ? secretKey : '';
        await this.createJoseInstance();
        this.certificateWaiter?.();
    }

    /**
     * The webhook's entry point for r_cert material. Only accepted while a redeem
     * this connector started is still outstanding (see `redeemCertificate`), and
     * only once per redeem — certificate material arriving at any other time is
     * unsolicited and dropped, whoever sent it. Returns whether it was taken.
     */
    async acceptCertificate(cert: string, secretKey: string): Promise<boolean> {
        if (Date.now() > this.certificateExpectedUntil) {
            console.warn('[keen] Unsolicited certificate material ignored: no certificate redeem is outstanding.');
            return false;
        }

        this.certificateExpectedUntil = 0;
        await this.setCertificate(cert, secretKey);

        return this.keenCertificate !== '';
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

    /**
     * Re-run the handshake after a WAKE (r_api_keys). The current application token,
     * certificate and secret stay in use until their replacements land, so a WAKE no
     * longer drops the site into maintenance while it waits for the next r_cert.
     */
    async reconnect(): Promise<void> {
        await this.renewApplicationToken();
        await this.refreshCertificate();

        await this.tryActivate(async () => {
            await this.resources.getConsumerContract();
            await this.resources.getConsumerPolicy();
            await this.resources.getSpaceList();
        });
    }

    /**
     * Claim + redeem a fresh certificate code (the r_cert notice). The old codes
     * must be cleared first: fetchCertificateRetrier loops only while they are
     * empty, so without this a re-fetch silently did nothing.
     */
    async refreshCertificate(): Promise<void> {
        this.claimCertificateCode = '';
        this.redeemedCertificateCode = false;
        await this.fetchCertificateRetrier();
    }

    /** Fetch a new application token in place, retrying every 2s, keeping the old one meanwhile. */
    private async renewApplicationToken(): Promise<void> {
        let attempt = 0;

        while (!(await this.fetchApplicationToken())) {
            attempt++;
            console.warn(`[keen] application_token renewal attempt ${attempt} failed — retrying in 2s`);
            await this.delay(2000);
        }
    }

    private async tryActivate(callback?: () => Promise<void>) {
        try {
            let attempt = 0;
            while (!this.keenCertificate || !this.applicationToken) {
                attempt++;
                console.log(`[BOOT] Application activated: FALSE. Retrying in 2s. (attempt ${attempt})`);
                await this.waitForCertificate(2000);

                // The certificate only ever arrives by webhook. While a new Cloud Run
                // revision rolls out, the OLD one still owns the public URL, so the r_cert
                // POST answering THIS instance's redeem can land there and this loop would
                // wait forever. No certificate after ~16s → claim and redeem a fresh code.
                if (attempt % CERTIFICATE_REDEEM_EVERY_ATTEMPTS === 0 && this.applicationToken && !this.keenCertificate) {
                    console.warn(`[keen] No certificate after ${attempt * 2}s — redeeming a fresh code`);
                    await this.refreshCertificate();
                }
            }
        } finally {
            this.active = true;
            try {
                if (callback) {
                    await callback();
                }
            } finally {
                // Boot is over — caches loaded, or a read failed and the webhooks will
                // refill them. Either way the proxy stops holding requests here.
                this.activated = true;
            }
        }

        console.log(`[BOOT] Application activated: ${this.active}`);
    }

    /**
     * Wait up to `ms` for a certificate, waking the moment setCertificate() stores
     * one. On a cold start the first visitor is held until boot finishes, so the r_cert
     * webhook must not sit up to 2s unnoticed.
     */
    private waitForCertificate(ms: number): Promise<void> {
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                this.certificateWaiter = null;
                resolve();
            }, ms);

            this.certificateWaiter = () => {
                clearTimeout(timer);
                this.certificateWaiter = null;
                resolve();
            };
        });
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

            const token = !!obj.result && typeof obj.result.access_token === 'string' ? obj.result.access_token : '';

            if (!token) {
                return false;
            }

            this.applicationToken = token;

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

            // Open the acceptance window BEFORE the request: Keen may post the r_cert
            // webhook before this response comes back.
            this.certificateExpectedUntil = Date.now() + CERTIFICATE_WINDOW_MS;

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

            // Status only — the body is the platform's reply about tenant key material.
            console.log(`[BOOT] Certificate redeem → HTTP ${result.status}`);

            if (!result.ok || !data) {
                this.certificateExpectedUntil = 0;
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
