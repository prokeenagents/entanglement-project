export const GUEST_API_CONFIG = {
    LOGIN: {
        URL: '/api/login'
    },
    LOGOUT: {
        URL: '/api/logout'
    },
    OTP: {
        URL: '/api/otp'
    },
    RESET_PASSWORD: {
        URL: '/api/reset-password'
    },
    SET_PASSWORD: {
        URL: '/api/set-password'
    },
    REGISTRATION: {
        URL: '/api/registration'
    },
    /**
     * Guest, deliberately: it is called precisely WHEN the access token has
     * expired, which makes `authorized` false and routes the request through
     * proxy-api-guest. Listing it under AUTH_API_CONFIG would 404 it in the exact
     * state it exists to fix. It self-authorizes on the refresh_token cookie, and
     * API_CONFIG spreads the guest surface, so it stays reachable while signed in
     * too (where the relay answers with its "still valid" fast-path).
     */
    REFRESH: {
        URL: '/api/refresh'
    }
};

/**
 * Authenticated-only API routes — the consumer chat surface. Reachable through
 * `proxy-api-auth` (which allow-lists API_CONFIG) but NOT through
 * `proxy-api-guest`, so a signed-out caller gets a 404.
 *
 * Paths are FLAT on purpose: the proxy allow-list is an EXACT `URLs.includes(pathname)`
 * match, so a dynamic segment (`/api/chat/[id]/history`) would never match and would
 * 404. Ids and filters ride query params (GET) or the body (POST) instead.
 */
export const AUTH_API_CONFIG = {
    CHAT_LIST: {
        URL: '/api/chat/list'
    },
    CHAT_HISTORY: {
        URL: '/api/chat/history'
    },
    CHAT_SEARCH: {
        URL: '/api/chat/search'
    },
    CHAT_SET_TITLE: {
        URL: '/api/chat/title'
    },
    CHAT_DELETE: {
        URL: '/api/chat/delete'
    },
    CONSUMER_UPDATE: {
        URL: '/api/consumer/update'
    },
    CONSUMER_PROFILE: {
        URL: '/api/consumer/profile'
    },
    CONSUMER_RESET_PASSWORD: {
        URL: '/api/consumer/reset-password'
    },
    EVENTS: {
        URL: '/api/events'
    },
    AGENT_FRONT_SETTINGS: {
        URL: '/api/agent-front-settings'
    }
};

export const API_CONFIG = {
    ...GUEST_API_CONFIG,
    ...AUTH_API_CONFIG
};
