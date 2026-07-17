import KeenConnector from './keen.connector';

export default class KeenCache {
    private googleConnect: unknown = null;
    private spaceList: unknown = null;
    private consumerContract: Keen.ConsumerContractResponse | null = null;

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
}
