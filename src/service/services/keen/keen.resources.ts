import KeenConnector from './keen.connector';

export default class KeenResources {
    constructor(private KeenConnector: KeenConnector) {}

    /**
     * Fetch the partner's Google Connect settings (application-token resource).
     * Returns the parsed body, false on a non-JSON response, or null when not
     * connected / on a transport error.
     */
    async getGoogleConnectResources() {
        const resourceName = 'Google Connect';
        const path = `/keen-api/resources/google_settings`;

        try {
            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');

            const requestOptions = {
                method: 'GET',
                headers: headers,
                redirect: 'follow'
            } as RequestInit;

            const result = await fetch(url, requestOptions);
            const text = await result.text();
            let data: unknown = text;

            try {
                data = JSON.parse(text);
            } catch {
                return false;
            }

            console.log(`[keen] Resources: ${resourceName} → HTTP ${result.status}`);

            if (result.ok) {
                this.KeenConnector.cache.setGoogleConnect(data);
            }

            return data;
        } catch (err) {
            console.log(`[keen] ERROR: Resources: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Fetch the list of spaces available to the partner (application-token
     * resource). Returns the parsed body, false on a non-JSON response, or null
     * when not connected / on a transport error.
     */
    async getSpaceList() {
        const resourceName = 'Space List';
        const path = `/keen-api/space/list`;

        try {
            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');

            const requestOptions = {
                method: 'GET',
                headers: headers,
                redirect: 'follow'
            } as RequestInit;

            const result = await fetch(url, requestOptions);
            const text = await result.text();
            let data: unknown = text;

            try {
                data = JSON.parse(text);
            } catch {
                return false;
            }

            console.log(`[keen] Resources: ${resourceName} → HTTP ${result.status}`);

            if (result.ok) {
                this.KeenConnector.cache.setSpaceList(data);
            }

            return data;
        } catch (err) {
            console.log(`[keen] ERROR: Resources: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Fetch THIS partner's consumer contract (application-token resource) — the
     * master `spaces` set plus the five per-contract policy booleans
     * (outsideRegistration, otp inside/outside, block inside/outside logins).
     * Scoped to the caller's own api_key by the relay. Returns the parsed body,
     * false on a non-JSON response, or null when not connected / on a transport
     * error (`result` is null when the api_key has no contract bound).
     */
    async getConsumerContract() {
        const resourceName = 'Consumer Contract';
        const path = `/keen-api/resources/consumer-contract`;

        try {
            if (!this.KeenConnector.isReady) {
                return null;
            }

            const url = `${this.KeenConnector.props.KEEN_HOST}${path}`;
            const headers = new Headers();

            headers.append('Authorization', `Bearer ${this.KeenConnector.token}`);
            headers.append('Origin', this.KeenConnector.props.ORIGIN);
            headers.append('Content-Type', 'application/json');

            const requestOptions = {
                method: 'GET',
                headers: headers,
                redirect: 'follow'
            } as RequestInit;

            const result = await fetch(url, requestOptions);
            const text = await result.text();
            let data: unknown = text;

            try {
                data = JSON.parse(text);
            } catch {
                return false;
            }

            console.log(`[keen] Resources: ${resourceName} → HTTP ${result.status}`);

            if (result.ok) {
                this.KeenConnector.cache.setConsumerContract(data as Keen.ConsumerContractResponse);
            }

            return data;
        } catch (err) {
            console.log(`[keen] ERROR: Resources: ${resourceName} → ${(err as Error).message}`);
            return null;
        }
    }

    /**
     * Clear the cached consumer contract. Call this when the partner receives an
     * `r_consumer_policy_delete` webhook — the contract was deleted upstream, so
     * there is nothing to re-fetch; the cache slot is reset to null and the
     * connector is marked inactive (isReady → false) until the next reconnect.
     */
    removeConsumerContract() {
        this.KeenConnector.cache.setConsumerContract(null);
        this.KeenConnector.setActive(false);
        console.log(`[keen] Resources: Consumer Contract → removed (cache cleared, connector deactivated)`);
    }
}
