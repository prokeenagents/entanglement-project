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
    }
};

export const API_CONFIG = {
    ...GUEST_API_CONFIG
};
