/**
 * Centralized environment variable helper.
 * Strictly enforces that required environment variables are set in production.
 * Prevents dangerous silent fallbacks to 'localhost' when deploying.
 */
export const getEnv = (key: string, devFallback?: string): string => {
    const value = process.env[key];
    if (value) {
        return value;
    }
    
    if (process.env.NODE_ENV !== 'production' && devFallback) {
        return devFallback;
    }

    // Fail loudly in production instead of silently using a localhost fallback
    throw new Error(`CRITICAL CONFIGURATION ERROR: Environment variable '${key}' is required in production!`);
};

export const getEnvArray = (key: string, devFallback?: string): string[] => {
    return getEnv(key, devFallback)
        .split(',')
        .map(s => {
            const trimmed = s.trim();
            // Remove trailing slash for CORS and redirect consistency
            return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
        })
        .filter(Boolean);
};
