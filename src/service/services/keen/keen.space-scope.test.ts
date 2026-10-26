import { describe, expect, it } from 'vitest';

import { scopeSpaceList } from './keen.space-scope';

const space = (id: string) => ({ id, title: id, description: `${id} description`, createdAt: '', updatedAt: '', deploymentToken: `dt-${id}`, agents: [] });

/** What /keen-api/space/list answered in the shared sandbox: the whole organization. */
const orgWideReply = { success: true, status: 200, message: 'OK', result: [space('ours-1'), space('ours-2'), space('other-partner'), space('internal')] };

const contract = { spaces: [{ id: 'ours-1', title: '' }, { id: 'ours-2', title: '' }] } as Keen.ConsumerContract;

describe('scopeSpaceList', () => {
    it("keeps only the contract's spaces", () => {
        const scoped = scopeSpaceList(orgWideReply, contract);

        expect(scoped?.result.map(s => s.id)).toEqual(['ours-1', 'ours-2']);
    });

    it('drops deploymentToken from every space', () => {
        const scoped = scopeSpaceList(orgWideReply, contract);

        for (const s of scoped?.result ?? []) {
            expect(s).not.toHaveProperty('deploymentToken');
        }
        expect(JSON.stringify(scoped)).not.toContain('dt-');
    });

    it('fails closed without a contract and rejects non-envelopes', () => {
        expect(scopeSpaceList(orgWideReply, null)?.result).toEqual([]);
        expect(scopeSpaceList('not json', contract)).toBeNull();
        expect(scopeSpaceList({ result: 'nope' }, contract)).toBeNull();
    });
});
