import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type KeenConnector from '@/service/services/keen/keen.connector';

import { APP_READY_WAIT_MS, isAppReady, waitForAppReady } from './demo';

const connector = (state: { isReady: boolean; isActivated: boolean }) => {
    globalThis.__keenConnector = state as unknown as KeenConnector;
    return state;
};

describe('isAppReady', () => {
    afterEach(() => {
        globalThis.__keenConnector = undefined;
    });

    it('needs the connector ready AND its boot reads done', () => {
        connector({ isReady: true, isActivated: false });
        expect(isAppReady()).toBe(false);

        connector({ isReady: true, isActivated: true });
        expect(isAppReady()).toBe(true);
    });

    it('is false without a connector', () => {
        expect(isAppReady()).toBe(false);
    });
});

describe('waitForAppReady', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        globalThis.__keenConnector = undefined;
    });

    it('resolves true at once when already ready', async () => {
        connector({ isReady: true, isActivated: true });
        await expect(waitForAppReady()).resolves.toBe(true);
    });

    it('holds the request until the boot finishes', async () => {
        const state = connector({ isReady: false, isActivated: false });
        const result = waitForAppReady();

        await vi.advanceTimersByTimeAsync(3000);
        state.isReady = true;
        state.isActivated = true;
        await vi.advanceTimersByTimeAsync(100);

        await expect(result).resolves.toBe(true);
    });

    it('gives up after the wait window while the boot is still running', async () => {
        connector({ isReady: false, isActivated: false });
        const result = waitForAppReady();

        await vi.advanceTimersByTimeAsync(APP_READY_WAIT_MS + 100);

        await expect(result).resolves.toBe(false);
    });

    it('does not wait on a booted connector that is not ready (contract removed)', async () => {
        connector({ isReady: false, isActivated: true });
        await expect(waitForAppReady()).resolves.toBe(false);
    });

    it('does not wait without a connector (missing config)', async () => {
        await expect(waitForAppReady()).resolves.toBe(false);
    });
});
