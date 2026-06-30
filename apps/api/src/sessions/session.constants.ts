export const SESSION_TOKEN_PREFIX = 'cs1.';
export const SESSION_TOKEN_RANDOM_BYTES = 32;
export const SESSION_TOKEN_PATTERN = /^cs1\.[A-Za-z0-9_-]{43}$/;

export const SESSION_ABSOLUTE_TTL_MS = 12 * 60 * 60 * 1000;
export const SESSION_IDLE_TTL_MS = 30 * 60 * 1000;
export const SESSION_ACTIVITY_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
