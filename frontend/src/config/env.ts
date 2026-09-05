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

    // Log the error but don't throw, otherwise React crashes and shows a blank white page.
    console.error("CRITICAL CONFIGURATION ERROR: 'VITE_API_URL' environment variable is missing in Vercel production!");
    return '';
};
