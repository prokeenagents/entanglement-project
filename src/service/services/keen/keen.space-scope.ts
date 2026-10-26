/**
 * Narrow a raw `GET /keen-api/space/list` reply before it is cached.
 *
 * The endpoint answers with EVERY space in the organization, not just the ones on
 * this api key's consumer contract. With more than one contract per organization
 * that hands this partner other partners' spaces, descriptions and agents. Until
 * the platform scopes the endpoint itself, the site keeps only the spaces its own
 * contract lists, and drops `deploymentToken` (a platform credential the partner
 * never needs) from each one.
 *
 * Fails closed: no contract loaded yet → no spaces. Returns null for a reply that
 * isn't a space-list envelope at all.
 */
export function scopeSpaceList(data: unknown, contract: Keen.ConsumerContract | null): Keen.SpaceListCache | null {
    if (typeof data !== 'object' || data === null || !Array.isArray((data as { result?: unknown }).result)) {
        return null;
    }

    // The wire shape still carries deploymentToken; the cached type does not.
    const envelope = data as Omit<Keen.SpaceListCache, 'result'> & { result: Array<Keen.SpaceListCacheResult & { deploymentToken?: unknown }> };
    const allowed = new Set((contract?.spaces ?? []).map(space => space.id));

    const result = envelope.result
        .filter(space => allowed.has(space.id))
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        .map(({ deploymentToken, ...space }) => space);

    return { success: envelope.success, status: envelope.status, message: envelope.message, result };
}
