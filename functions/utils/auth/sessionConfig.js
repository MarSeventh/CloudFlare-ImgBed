const DEFAULT_SESSION_MAX_AGE_DAYS = 14;
const MAX_SESSION_MAX_AGE_DAYS = 3650;
const SECONDS_PER_DAY = 86400;
const MAX_KV_EXPIRATION_TTL = 2147483647;

/**
 * Normalize persisted session max age to an integer day count.
 * Values outside the expected day range are treated as invalid so timestamp
 * values such as Date.now() do not become long-lived sessions.
 */
export function normalizeSessionMaxAgeDays(value) {
    const days = typeof value === 'string' && value.trim() !== ''
        ? Number(value)
        : value;

    if (!Number.isFinite(days)) {
        return DEFAULT_SESSION_MAX_AGE_DAYS;
    }

    const normalizedDays = Math.trunc(days);
    if (normalizedDays < 1 || normalizedDays > MAX_SESSION_MAX_AGE_DAYS) {
        return DEFAULT_SESSION_MAX_AGE_DAYS;
    }

    return normalizedDays;
}

export function sessionMaxAgeDaysToTtl(days) {
    const normalizedDays = normalizeSessionMaxAgeDays(days);
    const ttl = normalizedDays * SECONDS_PER_DAY;
    return Math.min(ttl, MAX_KV_EXPIRATION_TTL);
}

