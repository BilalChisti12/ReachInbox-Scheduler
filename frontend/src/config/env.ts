/**
 * Centralized environment variable helper for the frontend.
 * Enforces that VITE_API_URL is configured in Vercel for production deployments.
 */
export const getApiUrl = (): string => {
    const url = import.meta.env.VITE_API_URL;
    if (url) {
        return url;
    }
    
    if (import.meta.env.DEV) {
        return 'http://localhost:5000';
    }

    // Fail loudly in Vercel production instead of silently routing API calls to localhost
    throw new Error("CRITICAL CONFIGURATION ERROR: 'VITE_API_URL' environment variable is missing in Vercel production!");
};
