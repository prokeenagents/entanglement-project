/**
 * Thin, SSR-safe wrapper around the browser `localStorage`.
 *
 * Next renders on the server, where `window` / `localStorage` don't exist — so
 * every method is a no-op (or returns a safe default) off the browser and
 * swallows the errors the API can throw (quota exceeded, disabled in private
 * mode). Values are JSON-serialised, so objects round-trip directly:
 *
 *   LocalStorage.create('otp', { hash });
 *   const otp = LocalStorage.getJson<{ hash: string }>('otp'); // { hash } | null
 *   LocalStorage.update('otp', { hash: next });
 *   LocalStorage.delete('otp');
 */

const isBrowser = (): boolean => typeof window !== 'undefined';

/** Read the raw stored string, or null when missing / off-browser / on error. */
const readRaw = (key: string): string | null => {
    if (!isBrowser()) {
        return null;
    }

    try {
        return window.localStorage.getItem(key);
    } catch {
        return null;
    }
};

/** JSON-serialise + write. No-op off-browser or if the write throws (quota). */
const writeJson = <T>(key: string, value: T): void => {
    if (!isBrowser()) {
        return;
    }

    try {
        window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // storage full / unavailable — caller degrades to "no cached value".
    }
};

export const LocalStorage = {
    /**
     * Read the raw stored string by key, WITHOUT JSON-parsing. Returns `null`
     * when the key is missing / on the server / on error. Use `getJson` for
     * values written with `setJson` / `create` / `update`.
     */
    get(key: string): string | null {
        return readRaw(key);
    },

    /**
     * Read a value by key and JSON-parse it. Returns `null` when the key is
     * missing, on the server, or if the stored value can't be parsed.
     */
    getJson<T>(key: string): T | null {
        const raw = readRaw(key);

        if (raw === null) {
            return null;
        }

        try {
            return JSON.parse(raw) as T;
        } catch {
            return null;
        }
    },

    /**
     * JSON-serialise `value` and write it under `key` — an unconditional upsert
     * (creates or overwrites). No-op on the server / on error.
     */
    setJson<T>(key: string, value: T): void {
        writeJson(key, value);
    },

    /**
     * Create a NEW entry — writes only when `key` is not already present.
     * Returns `true` if it was created, `false` if the key already existed (or
     * off the browser). Use `setJson` for an unconditional upsert.
     */
    create<T>(key: string, value: T): boolean {
        if (!isBrowser() || readRaw(key) !== null) {
            return false;
        }

        writeJson(key, value);
        return true;
    },

    /**
     * Update an EXISTING entry — writes only when `key` is already present.
     * Returns `true` if it was updated, `false` if the key was absent (or off
     * the browser).
     */
    update<T>(key: string, value: T): boolean {
        if (!isBrowser() || readRaw(key) === null) {
            return false;
        }

        writeJson(key, value);
        return true;
    },

    /**
     * Delete a key. No-op on the server / on error.
     */
    delete(key: string): void {
        if (!isBrowser()) {
            return;
        }

        try {
            window.localStorage.removeItem(key);
        } catch {
            // nothing to do — the key is effectively gone.
        }
    }
};
