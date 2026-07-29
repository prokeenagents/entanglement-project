import KeenConnector from './keen.connector';

export default class KeenCache {
    private googleConnect: unknown = null;
    private spaceList: unknown = null;
    private consumerContract: Keen.ConsumerContractResponse | null = null;
    /** Per-agent Front Settings (raw JSON string, '' = none), keyed by agent SLUG. Lazily filled, refreshed by the webhook. */
    private frontSettings = new Map<string, string>();

    constructor(private KeenConnector: KeenConnector) {}

    /**
     * Store the latest successful Google Connect settings result.
     */
    setGoogleConnect(data: unknown) {
        this.googleConnect = data;
    }

    /**
     * Return the cached Google Connect settings, or null if none fetched yet.
     */
    getGoogleConnect(): unknown {
        return this.googleConnect;
    }

    /**
     * Store the latest successful Space List result.
     */
    setSpaceList(data: unknown) {
        this.spaceList = data;
    }

    /**
     * Return the cached Space List, or null if none fetched yet.
     */
    getSpaceList(): Keen.SpaceListCache {
        return this.spaceList as Keen.SpaceListCache;
    }

    /**
     * Store the latest successful Consumer Contract result (the partner's own
     * contract — master spaces set + the five consumer-policy booleans).
     */
    setConsumerContract(data: Keen.ConsumerContractResponse | null) {
        this.consumerContract = data;
    }

    /**
     * Return the cached Consumer Contract, or null if none fetched yet.
     */
    getConsumerContract(): Keen.ConsumerContractResponse | null {
        return this.consumerContract;
    }

    /**
     * Store one agent's Front Settings JSON ('' means "agent has none").
     */
    setAgentFrontSettings(agentId: string, jsonSettings: string) {
        this.frontSettings.set(agentId, jsonSettings);
    }

    /**
     * Return the cached Front Settings for one agent, or null if never fetched —
     * null tells the caller to fetch, '' tells it the agent HAS no settings.
     */
    getAgentFrontSettings(agentId: string): string | null {
        return this.frontSettings.has(agentId) ? (this.frontSettings.get(agentId) as string) : null;
    }

    /**
     * The agent slugs currently held — the webhook refresh re-fetches exactly
     * these (the agents this site actually uses), never the whole org.
     */
    getAgentFrontSettingsKeys(): string[] {
        return [...this.frontSettings.keys()];
    }
}
