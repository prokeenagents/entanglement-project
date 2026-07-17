export const GUEST_PAGE_CONFIG = {
    LOGIN: {
        URL: '/login'
    },
    RESET_PASSWORD: {
        URL: '/reset-password'
    },
    SET_PASSWORD: {
        URL: '/set-password'
    },

    REGISTRATION: {
        URL: '/registration'
    },
    /**
     * Where the consumer LANDS from the registration verification link Keen emails —
     * sent as X-Callback-Url on the registration claim. `auth.middleware.ts` already
     * lets `/confirmation/*` through unauthenticated, so the two must stay in step.
     */
    CONFIRMATION: {
        URL: '/confirmation'
    }
};

export const PAGE_CONFIG = {
    ...GUEST_PAGE_CONFIG,
    MAINTENANCE: {
        URL: '/maintenance'
    }
};
