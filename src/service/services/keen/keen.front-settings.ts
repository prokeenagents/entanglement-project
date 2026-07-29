import KeenConnector from './keen.connector';

/**
 * One row of an agent's Front Settings, as the org's settings form stores it.
 * `value`'s runtime shape depends on `fieldType` (string, number, boolean,
 * string[]); `valid === false` marks a row saved before it passed validation —
 * consumers must skip it, same rule the engine's system/settings applies.
 */
type FrontSettingsRow = {
    fieldId?: string;
    displayName?: string;
    fieldType?: string;
    required?: boolean;
    valid?: boolean;
    value?: unknown;
};

/**
 * Value-level reads over an agent's Front Settings — the partner-side mirror
 * of the engine's `system/settings` API (get / getMany / has; deliberately no
 * `all()`: callers must NAME the fields they consume, so a grep finds every
 * dependency on a field before the org renames it).
 *
 * Resolution is cache-first: the connector cache holds what the webhook
 * receiver last fetched; a miss goes to the relay's tenancy-scoped resource
 * endpoint and self-primes, after which the `r_agent_front_settings` webhook
 * keeps this agent fresh. '' (agent has no settings) resolves every read to
 * undefined/false without an error.
 */
export default class KeenFrontSettings {
    constructor(private KeenConnector: KeenConnector) {}

    /**
     * Load one agent's rows as a fieldId → value map. Invalid rows and rows
     * without a fieldId are dropped; a broken/unavailable blob resolves to an
     * EMPTY map (fail-soft — reads degrade to undefined, they never throw).
     */
    private async load(agentId: string): Promise<Map<string, unknown>> {
        let json = this.KeenConnector.cache.getAgentFrontSettings(agentId);

        if (json === null) {
            const fetched = await this.KeenConnector.resources.getAgentFrontSettings(agentId);
            json = typeof fetched === 'string' ? fetched : '';
        }

        const map = new Map<string, unknown>();

        if (!json) {
            return map;
        }

        try {
            const rows = JSON.parse(json) as FrontSettingsRow[];

            if (!Array.isArray(rows)) {
                return map;
            }

            for (const row of rows) {
                const fieldId = row?.fieldId?.trim();

                if (!fieldId || row.valid === false || map.has(fieldId)) {
                    continue;
                }

                map.set(fieldId, row.value);
            }
        } catch {
            console.log(`[keen] Front Settings: unparsable blob for agent "${agentId}" — treating as empty`);
        }

        return map;
    }

    /** The value of ONE field, or undefined when the field (or the agent's settings) doesn't exist. */
    async get(agentId: string, fieldId: string): Promise<unknown> {
        const map = await this.load(agentId);

        return map.get(fieldId);
    }

    /**
     * The values of SEVERAL fields in one load, aligned with the requested
     * order — a missing field yields undefined at its position.
     */
    async getMany(agentId: string, ...fieldIds: string[]): Promise<unknown[]> {
        const map = await this.load(agentId);

        return fieldIds.map(fieldId => map.get(fieldId));
    }

    /** Whether the field exists (valid row with this fieldId), regardless of its value. */
    async has(agentId: string, fieldId: string): Promise<boolean> {
        const map = await this.load(agentId);

        return map.has(fieldId);
    }
}
