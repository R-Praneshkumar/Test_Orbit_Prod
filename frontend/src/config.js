/**
 * Central configuration — all environment-dependent values in one place.
 */
import { supabase } from './utils/supabaseClient';

const BACKEND_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const API_BASE = `${BACKEND_URL}/api/v1`;
export const MOCK_BASE = `${BACKEND_URL}/mock-server`;
export { BACKEND_URL };

/**
 * Authenticated fetch — wraps native fetch() and auto-attaches the Supabase
 * Bearer token from the current session. Use this for all API_BASE calls.
 * Mock server calls require this wrapper too.
 */
export async function authFetch(url, options = {}) {
    const headers = { ...options.headers };

    // Get the current session token from Supabase (if available)
    try {
        if (supabase) {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                headers['Authorization'] = `Bearer ${session.access_token}`;
            }
        }
    } catch {
        // Supabase not configured — proceed without auth
    }

    return fetch(url, { ...options, headers });
}
