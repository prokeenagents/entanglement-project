/**
 * The pending-OTP handoff, shared by the three files that touch it: the login
 * form mints the hash, Content seeds state from it and expires it, the OTP form
 * spends it.
 *
 * The stored `timestamp` is a DEADLINE — `Date.now() + TTL_MS`, stamped at write
 * time — NOT the moment of creation. That is what makes `timestamp <= Date.now()`
 * mean "expired"; had it stored a creation time, that comparison would be true
 * for every hash the instant it was written.
 */
export const OTP_CONFIG = {
    /** localStorage key holding the `App.Login.HashObject`. */
    STORAGE_KEY: 'otp-hash',

    /** How long a minted OTP hash stays usable before Content expires it. */
    TTL_MS: 2 * 60 * 1000,

    /**
     * How often the OTP form re-reads the clock to redraw its countdown. Purely
     * cosmetic — expiry itself is enforced by Content's one-shot timer, not by
     * this tick — so it only needs to be fine enough to look smooth.
     */
    TICK_MS: 1000
};
