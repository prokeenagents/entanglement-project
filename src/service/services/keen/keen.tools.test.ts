import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/cookies', () => ({
    getAccessToken: async () => 'access-token-value',
    getRefreshToken: async () => 'refresh-token-value-28-days'
}));

import KeenConnector from './keen.connector';

describe('KeenTools.getConsumerData', () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('never returns the refresh token (this object is serialized to the browser)', async () => {
        const connector = new KeenConnector({ KEEN_HOST: 'https://keen.test', ORIGIN: 'https://site.test', CLIENT_ID: 'c', CLIENT_SECRET: 's', API_KEY_ID: 'k', API_KEY_SECRET: 'ks' });

        const data = await connector.tools.getConsumerData();

        expect(data).not.toHaveProperty('refreshToken');
        expect(JSON.stringify(data)).not.toContain('refresh-token-value');
        // The access token stays: the chat WebSocket needs it.
        expect(data.accessToken).toBe('access-token-value');
    });
});
