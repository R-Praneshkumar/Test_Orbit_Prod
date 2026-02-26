/**
 * Unified fetch utility: routes through backend proxy (cloud mode) or
 * directly from the browser (local mode).  Both paths return the same
 * normalised shape: { status, statusText, data, headers }.
 */
import { API_BASE, authFetch } from '../config';

export async function proxyFetch({ url, method = 'GET', headers = {}, body = null, localMode = false }) {
    if (localMode) {
        // --- Local Mode: direct browser fetch (supports localhost) ---
        try {
            const opts = { method, headers: { ...headers } };
            if (body && method !== 'GET' && method !== 'HEAD') {
                opts.body = typeof body === 'string' ? body : JSON.stringify(body);
                if (!opts.headers['Content-Type']) opts.headers['Content-Type'] = 'application/json';
            }
            const res = await fetch(url, opts);
            const text = await res.text();
            let data;
            try { data = JSON.parse(text); } catch { data = text; }
            const resHeaders = {};
            res.headers.forEach((v, k) => { resHeaders[k] = v; });
            return { status: res.status, statusText: res.statusText, data, headers: resHeaders };
        } catch (err) {
            const isCors = err.message?.includes('Failed to fetch') || err.name === 'TypeError';
            return {
                status: 0,
                statusText: 'Network Error',
                data: isCors
                    ? `CORS Error: The server at ${url} did not allow this request from the browser.\nFix: Add CORS headers to your server, or switch to Cloud Mode.`
                    : `Request failed: ${err.message}`,
                headers: {}
            };
        }
    }

    // --- Cloud Mode: route through backend proxy ---
    const res = await authFetch(`${API_BASE}/proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, method, headers, body })
    });
    return await res.json();
}
