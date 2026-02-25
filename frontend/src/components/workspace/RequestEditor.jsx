import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Activity, AlertCircle, CheckCircle, Clock, FileText, Copy, Download, Link, Code2 } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { ResizeHandle } from './ResizeHandle';
import { CustomMethodSelect } from './CustomMethodSelect';
import { KeyValueEditor } from './KeyValueEditor';
import { JsonViewer, TableViewer } from './JsonViewer';
import { CodeGenModal } from './CodeGenModal';
import { runPreRequestScript, runPostResponseScript } from '../../utils/scriptEngine';
import { evaluateAssertions, createAssertion } from '../../utils/assertionEngine';

import { API_BASE, authFetch } from '../../config';

// --- Auto-Auth Panel (Smart Token Management) ---
const AutoAuthPanel = ({ request, handleChange }) => {
    const [tokenStatus, setTokenStatus] = React.useState(null); // 'idle' | 'loading' | 'success' | 'error'
    const [tokenError, setTokenError] = React.useState(null);
    const [lastTokenTime, setLastTokenTime] = React.useState(request.autoAuthToken ? 'cached' : null);

    const handleTestLogin = async () => {
        setTokenStatus('loading');
        setTokenError(null);
        try {
            let loginBody = null;
            const bodyStr = request.autoAuthBody || '';
            if (bodyStr.trim()) {
                try { loginBody = JSON.parse(bodyStr); } catch { loginBody = bodyStr; }
            }

            // Build custom login headers from the configured key-value pairs
            const loginHeaders = { 'Content-Type': 'application/json' };
            (request.autoAuthLoginHeaders || []).forEach(h => {
                if (h.key && h.key.trim()) loginHeaders[h.key.trim()] = h.value || '';
            });

            const res = await authFetch(`${API_BASE}/proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: request.autoAuthLoginUrl,
                    method: request.autoAuthMethod || 'POST',
                    headers: loginHeaders,
                    body: loginBody,
                })
            });
            const result = await res.json();

            if (!res.ok || result.status >= 400) {
                setTokenStatus('error');
                setTokenError(`Login returned ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`);
                return;
            }

            // Extract token using the configured path
            const tokenPath = (request.autoAuthTokenPath || 'token').split('.');
            let token = result.data;
            for (const key of tokenPath) {
                if (token && typeof token === 'object') token = token[key];
                else { token = null; break; }
            }

            if (!token || typeof token !== 'string') {
                setTokenStatus('error');
                setTokenError(`Could not find token at path "${request.autoAuthTokenPath || 'token'}" in response: ${JSON.stringify(result.data).slice(0, 200)}`);
                return;
            }

            handleChange('autoAuthToken', token);
            handleChange('autoAuthTokenTime', Date.now());
            setLastTokenTime(new Date().toLocaleTimeString());
            setTokenStatus('success');
        } catch (err) {
            setTokenStatus('error');
            setTokenError(err.message);
        }
    };

    const inputClass = "w-full text-xs font-mono px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none focus:ring-1 focus:ring-corporate-500 text-slate-700 dark:text-slate-300";
    const labelClass = "text-[10px] text-slate-500 dark:text-slate-400 mb-1 block";

    return (
        <div className="space-y-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-[10px] text-blue-700 dark:text-blue-300">
                    <strong>💡 How it works:</strong> Configure your login endpoint below. When you send this request,
                    TestOrbit will <strong>automatically call your login API first</strong>, extract the token, and attach it as a Bearer header.
                </p>
            </div>

            {/* Login URL */}
            <div>
                <label className={labelClass}>Login Endpoint URL</label>
                <input
                    type="text"
                    value={request.autoAuthLoginUrl || ''}
                    onChange={(e) => handleChange('autoAuthLoginUrl', e.target.value)}
                    placeholder="https://your-api.com/api/login"
                    className={inputClass}
                />
            </div>

            {/* Method */}
            <div>
                <label className={labelClass}>Method</label>
                <select
                    value={request.autoAuthMethod || 'POST'}
                    onChange={(e) => handleChange('autoAuthMethod', e.target.value)}
                    className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-corporate-500 text-slate-700 dark:text-slate-300"
                >
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="GET">GET</option>
                </select>
            </div>

            {/* Login Request Headers */}
            <div>
                <label className={labelClass}>Login Request Headers (Optional)</label>
                <p className="text-[9px] text-slate-400 dark:text-slate-500 mb-1.5">
                    Headers sent <strong>with the login request</strong> (e.g. Supabase requires <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">apikey</code>).
                </p>
                <div className="space-y-1.5">
                    {(request.autoAuthLoginHeaders || []).map((h, idx) => (
                        <div key={idx} className="flex gap-1.5 items-center">
                            <input
                                type="text"
                                value={h.key || ''}
                                onChange={e => {
                                    const updated = [...(request.autoAuthLoginHeaders || [])];
                                    updated[idx] = { ...updated[idx], key: e.target.value };
                                    handleChange('autoAuthLoginHeaders', updated);
                                }}
                                placeholder="Header name (e.g. apikey)"
                                className={`${inputClass} flex-1`}
                            />
                            <input
                                type="text"
                                value={h.value || ''}
                                onChange={e => {
                                    const updated = [...(request.autoAuthLoginHeaders || [])];
                                    updated[idx] = { ...updated[idx], value: e.target.value };
                                    handleChange('autoAuthLoginHeaders', updated);
                                }}
                                placeholder="Value"
                                className={`${inputClass} flex-1 font-mono`}
                            />
                            <button
                                onClick={() => handleChange('autoAuthLoginHeaders', (request.autoAuthLoginHeaders || []).filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-red-500 transition-colors shrink-0 text-xs px-1"
                            >✕</button>
                        </div>
                    ))}
                    <button
                        onClick={() => handleChange('autoAuthLoginHeaders', [...(request.autoAuthLoginHeaders || []), { key: '', value: '' }])}
                        className="text-[10px] text-corporate-600 dark:text-corporate-400 hover:underline"
                    >+ Add Header</button>
                </div>
            </div>

            {/* Login Body */}
            <div>
                <label className={labelClass}>Login Request Body (JSON)</label>
                <textarea
                    value={request.autoAuthBody || ''}
                    onChange={(e) => handleChange('autoAuthBody', e.target.value)}
                    placeholder='{\n  "email": "user@example.com",\n  "password": "your-password"\n}'
                    className={`${inputClass} resize-none`}
                    rows={4}
                />
            </div>

            {/* Token Path */}
            <div>
                <label className={labelClass}>Token Path (dot notation)</label>
                <input
                    type="text"
                    value={request.autoAuthTokenPath || ''}
                    onChange={(e) => handleChange('autoAuthTokenPath', e.target.value)}
                    placeholder="token"
                    className={inputClass}
                />
                <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-1">
                    Path to the token in the login response. Examples: <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">token</code>,
                    <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded ml-1">data.accessToken</code>,
                    <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded ml-1">result.jwt</code>
                </p>
            </div>

            {/* Test Login + Status */}
            <div className="flex items-center gap-2 pt-1">
                <button
                    onClick={handleTestLogin}
                    disabled={tokenStatus === 'loading' || !request.autoAuthLoginUrl}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-gradient-to-r from-corporate-600 to-corporate-500 hover:from-corporate-700 hover:to-corporate-600 disabled:from-slate-300 disabled:to-slate-300 rounded-lg transition-all shadow-sm"
                >
                    {tokenStatus === 'loading' ? '⏳ Logging in...' : '🔑 Test Login Now'}
                </button>
                {request.autoAuthToken && (
                    <button
                        onClick={() => { handleChange('autoAuthToken', ''); handleChange('autoAuthTokenTime', null); setTokenStatus(null); }}
                        className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors"
                    >
                        Clear Token
                    </button>
                )}
            </div>

            {/* Success */}
            {tokenStatus === 'success' && request.autoAuthToken && (
                <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-green-700 dark:text-green-400">✓ Token Acquired</span>
                        <span className="text-[9px] text-green-600 dark:text-green-400">at {lastTokenTime}</span>
                    </div>
                    <code className="text-[10px] text-green-800 dark:text-green-300 break-all block max-h-16 overflow-auto font-mono">
                        {request.autoAuthToken?.length > 80 ? request.autoAuthToken.slice(0, 80) + '...' : request.autoAuthToken}
                    </code>
                </div>
            )}

            {/* Error */}
            {tokenStatus === 'error' && (
                <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <span className="text-[10px] font-bold text-red-600 dark:text-red-400">✗ Login Failed</span>
                    <p className="text-[10px] text-red-500 dark:text-red-400 mt-0.5 break-all">{tokenError}</p>
                </div>
            )}

            <p className="text-[9px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-2">
                When you send this request, token will be <strong>automatically refreshed</strong> if expired (401).
                Sent as <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Authorization: Bearer &lt;token&gt;</code>
            </p>
        </div>
    );
};


// --- URL <-> Params Sync Utilities ---
const parseUrlParams = (url) => {
    try {
        const urlObj = new URL(url);
        const params = [];
        urlObj.searchParams.forEach((value, key) => {
            params.push({ key, value, enabled: true });
        });
        return params;
    } catch {
        const qIndex = url.indexOf('?');
        if (qIndex === -1) return [];
        return url.slice(qIndex + 1).split('&')
            .map(pair => {
                const [key, ...rest] = pair.split('=');
                return key ? { key, value: rest.join('='), enabled: true } : null;
            })
            .filter(Boolean);
    }
};

const getBaseUrl = (url) => {
    const qIndex = url.indexOf('?');
    return qIndex === -1 ? url : url.slice(0, qIndex);
};

const buildUrlWithParams = (url, params) => {
    const base = getBaseUrl(url);
    const enabled = (params || []).filter(p => p.enabled !== false && p.key);
    if (enabled.length === 0) return base;
    return `${base}?${enabled.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value || '')}`).join('&')}`;
};

export const RequestEditor = ({ tabId }) => {
    const updateRequest = useWorkspaceStore(state => state.updateRequest);
    const setResponseLoading = useWorkspaceStore(state => state.setResponseLoading);
    const setResponseData = useWorkspaceStore(state => state.setResponseData);
    const resolveVariables = useWorkspaceStore(state => state.resolveVariables);
    const setChainVar = useWorkspaceStore(state => state.setChainVar);
    const chainVars = useWorkspaceStore(state => state.chainVars);
    const environments = useWorkspaceStore(state => state.environments);
    const activeEnv = useWorkspaceStore(state => state.activeEnv);
    const addRequestHistory = useWorkspaceStore(state => state.addRequestHistory);
    const updateEnvVars = useWorkspaceStore(state => state.updateEnvVars);
    const request = useWorkspaceStore(state => state.activeTabs.find(t => t.id === tabId));
    const responseEntry = useWorkspaceStore(state => state.responses[tabId]);
    const collections = useWorkspaceStore(state => state.collections);
    const activeCollectionId = useWorkspaceStore(state => state.activeCollectionId);
    const localMode = useWorkspaceStore(state => state.localMode);
    const editorSplitRatio = useWorkspaceStore(state => state.editorSplitRatio);
    const setEditorSplitRatio = useWorkspaceStore(state => state.setEditorSplitRatio);
    const splitContainerRef = useRef(null);

    const handleEditorSplitResize = useCallback((clientX) => {
        if (!splitContainerRef.current) return;
        const rect = splitContainerRef.current.getBoundingClientRect();
        const ratio = (clientX - rect.left) / rect.width;
        setEditorSplitRatio(ratio);
    }, [setEditorSplitRatio]);

    // Derived from store
    const loading = responseEntry?.loading || false;
    const response = responseEntry?.data || null;
    const responseTime = responseEntry?.time || null;

    const [localUrl, setLocalUrl] = useState(request?.url || '');
    const [activeSubTab, setActiveSubTab] = useState('params');
    const [responseTab, setResponseTab] = useState('body');
    const [extractPath, setExtractPath] = useState('');
    const [extractName, setExtractName] = useState('');
    const [extractFeedback, setExtractFeedback] = useState(null);
    const [showCodeGen, setShowCodeGen] = useState(false);
    const [scriptResults, setScriptResults] = useState(null); // { pre, post } script execution results
    const [assertionResults, setAssertionResults] = useState(null); // evaluated assertion results
    const [responseViewMode, setResponseViewMode] = useState('json'); // 'json' | 'table'
    const [debugEntries, setDebugEntries] = useState([]); // debug console entries

    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    useEffect(() => { setLocalUrl(request?.url || ''); }, [request?.id]);

    // Extract a value from response data using dot-notation path (e.g., "data.token")
    const getByPath = (obj, path) => {
        return path.split('.').reduce((curr, key) => {
            if (curr == null) return undefined;
            // Handle array index like "items.0.id"
            const idx = parseInt(key);
            if (!isNaN(idx) && Array.isArray(curr)) return curr[idx];
            return curr[key];
        }, obj);
    };

    const handleExtractVar = () => {
        if (!extractPath.trim() || !extractName.trim() || !response?.data) return;
        const value = getByPath(response.data, extractPath.trim());
        if (value === undefined) {
            setExtractFeedback({ ok: false, msg: `Path "${extractPath}" not found in response` });
        } else {
            const strValue = typeof value === 'string' ? value : JSON.stringify(value);
            setChainVar(extractName.trim(), strValue);
            setExtractFeedback({ ok: true, msg: `Saved {{${extractName.trim()}}} = ${strValue.length > 50 ? strValue.slice(0, 50) + '...' : strValue}` });
            setExtractPath('');
            setExtractName('');
        }
        setTimeout(() => setExtractFeedback(null), 4000);
    };

    // Build the current environment vars array
    const getEnvVars = () => {
        const globalEnv = environments.find(e => e.name === 'Global');
        const activeEnvObj = environments.find(e => e.name === activeEnv);
        const vars = [...(globalEnv?.vars || [])];
        if (activeEnvObj && activeEnvObj.name !== 'Global') {
            vars.push(...(activeEnvObj.vars || []));
        }
        return vars;
    };

    // Apply environment variable changes from script execution back to the store
    const applyEnvVarChanges = (updatedEnvVars) => {
        if (!updatedEnvVars) return;
        const targetEnv = activeEnv || 'Global';
        const currentEnvObj = environments.find(e => e.name === targetEnv);
        const currentVars = currentEnvObj?.vars || [];

        // Merge updated values into the existing vars array
        const existingKeys = new Set(currentVars.map(v => v.key));
        const newVars = currentVars.map(v => {
            if (v.key && updatedEnvVars[v.key] !== undefined && updatedEnvVars[v.key] !== v.value) {
                return { ...v, value: updatedEnvVars[v.key] };
            }
            return v;
        });
        // Add any new keys that were set by the script
        Object.entries(updatedEnvVars).forEach(([key, value]) => {
            if (key && !existingKeys.has(key)) {
                newVars.push({ key, value, enabled: true });
            }
        });
        updateEnvVars(targetEnv, newVars);
    };

    // Actually execute the HTTP request via backend proxy
    const handleRun = async () => {
        if (!localUrl) {
            setResponseData(tabId, { error: 'Please enter a URL' }, null);
            return;
        }

        setResponseLoading(tabId, true);
        setScriptResults(null);
        setAssertionResults(null);
        setDebugEntries([]);
        const debugLog = [];
        const startTime = Date.now();

        // Resolve {{variable}} placeholders
        const resolvedUrl = resolveVariables(localUrl);
        if (resolvedUrl !== localUrl) {
            debugLog.push({ type: 'info', message: `URL resolved: ${localUrl} → ${resolvedUrl}`, timestamp: Date.now() });
        } else {
            debugLog.push({ type: 'info', message: `URL: ${resolvedUrl}`, timestamp: Date.now() });
        }

        // --- Run Collection Pre-request Script ---
        const currentCol = collections.find(c => c.id === activeCollectionId);
        let colPreResult = null;
        if (currentCol?.preScript?.trim()) {
            colPreResult = runPreRequestScript(currentCol.preScript, {
                variables: { ...chainVars },
                environment: getEnvVars(),
                request: { ...request, url: resolvedUrl },
            });
            if (colPreResult.updatedVars) {
                Object.entries(colPreResult.updatedVars).forEach(([k, v]) => {
                    if (chainVars[k] !== v) setChainVar(k, v);
                });
            }
            if (colPreResult.updatedEnvVars) applyEnvVarChanges(colPreResult.updatedEnvVars);
        }

        // --- Run Request Pre-request Script ---
        let preResult = null;
        if (request.preScript?.trim()) {
            preResult = runPreRequestScript(request.preScript, {
                variables: { ...chainVars, ...(colPreResult?.updatedVars || {}) },
                environment: getEnvVars(),
                request: { ...request, url: resolvedUrl },
            });
            if (preResult.updatedVars) {
                Object.entries(preResult.updatedVars).forEach(([k, v]) => {
                    if (chainVars[k] !== v) setChainVar(k, v);
                });
            }
            if (preResult.updatedEnvVars) applyEnvVarChanges(preResult.updatedEnvVars);
            if (!preResult.success) {
                const elapsed = Date.now() - startTime;
                setScriptResults({ pre: preResult, post: null });
                setResponseData(tabId, {
                    status: 0,
                    statusText: 'Pre-script Error',
                    data: `Pre-request script failed: ${preResult.error}`,
                    success: false
                }, elapsed);
                return;
            }
        }

        try {
            // Build headers from key-value pairs (with variable resolution)
            const headers = {};
            (request.headers || []).forEach(h => {
                if (h.enabled !== false && h.key) {
                    headers[resolveVariables(h.key)] = resolveVariables(h.value);
                }
            });

            // Apply auth headers (with collection-level inheritance + force support)
            // Priority: force collection auth > own auth > inherit from collection
            let effectiveAuthType = request.authType;
            let authSource = request;

            const currentCol = collections.find(c => c.id === activeCollectionId);

            // Force collection auth: override all individual request auth
            if (currentCol?.forceCollectionAuth && currentCol.authType && currentCol.authType !== 'none') {
                effectiveAuthType = currentCol.authType;
                authSource = currentCol;
            } else if (effectiveAuthType === 'none') {
                // "No Auth" explicitly selected — skip inheritance
                // No auth, do nothing
            } else if (!effectiveAuthType || effectiveAuthType === 'inherit') {
                // Inherit from collection (undefined/empty also inherits)
                if (currentCol && currentCol.authType && currentCol.authType !== 'none') {
                    effectiveAuthType = currentCol.authType;
                    authSource = currentCol;
                } else {
                    effectiveAuthType = 'none';
                }
            }

            if (effectiveAuthType === 'bearer' && authSource.authToken) {
                headers['Authorization'] = `Bearer ${resolveVariables(authSource.authToken)}`;
            } else if (effectiveAuthType === 'basic' && authSource.authUsername) {
                headers['Authorization'] = `Basic ${btoa(`${resolveVariables(authSource.authUsername || '')}:${resolveVariables(authSource.authPassword || '')}`)}`;
            } else if (effectiveAuthType === 'apikey' && authSource.authKeyValue) {
                headers[resolveVariables(authSource.authKeyName || 'X-API-Key')] = resolveVariables(authSource.authKeyValue);
            } else if (effectiveAuthType === 'auto-auth' && authSource.autoAuthLoginUrl) {
                // Auto-Auth: automatically call login endpoint to get a fresh token
                // authSource is either the request itself or the collection (when inheriting)
                let token = authSource.autoAuthToken || '';
                const tokenAge = authSource.autoAuthTokenTime ? Date.now() - authSource.autoAuthTokenTime : Infinity;
                const needsRefresh = !token || tokenAge > 30 * 60 * 1000; // Refresh if >30 min old or missing

                if (needsRefresh) {
                    try {
                        let loginBody = null;
                        const bodyStr = authSource.autoAuthBody || '';
                        if (bodyStr.trim()) {
                            try { loginBody = JSON.parse(bodyStr); } catch { loginBody = bodyStr; }
                        }
                        // Build custom login headers (e.g. Supabase apikey)
                        const loginHeaders = { 'Content-Type': 'application/json' };
                        (authSource.autoAuthLoginHeaders || []).forEach(h => {
                            if (h.key && h.key.trim()) loginHeaders[h.key.trim()] = h.value || '';
                        });
                        const loginRes = await authFetch(`${API_BASE}/proxy`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                url: authSource.autoAuthLoginUrl,
                                method: authSource.autoAuthMethod || 'POST',
                                headers: loginHeaders,
                                body: loginBody,
                            })
                        });
                        const loginResult = await loginRes.json();
                        if (loginRes.ok && loginResult.status < 400) {
                            const tokenPath = (authSource.autoAuthTokenPath || 'token').split('.');
                            let extracted = loginResult.data;
                            for (const key of tokenPath) {
                                if (extracted && typeof extracted === 'object') extracted = extracted[key];
                                else { extracted = null; break; }
                            }
                            if (extracted && typeof extracted === 'string') {
                                token = extracted;
                                // Cache token on the source (request or collection)
                                if (request.authType === 'inherit') {
                                    const updateCollection = useWorkspaceStore.getState().updateCollection;
                                    updateCollection(activeCollectionId, { autoAuthToken: token, autoAuthTokenTime: Date.now() });
                                } else {
                                    updateRequest(request.id, { autoAuthToken: token, autoAuthTokenTime: Date.now() });
                                }
                            }
                        }
                    } catch (e) {
                        console.warn('Auto-auth login failed:', e);
                    }
                }
                if (token) {
                    headers['Authorization'] = `Bearer ${token}`;
                }
            }

            // Debug: log headers
            debugLog.push({ type: 'info', message: `Method: ${request.method || 'GET'}`, timestamp: Date.now() });
            const headerKeys = Object.keys(headers);
            if (headerKeys.length > 0) {
                debugLog.push({ type: 'info', message: `Headers: ${headerKeys.map(k => `${k}: ${headers[k]}`).join(', ')}`, timestamp: Date.now() });
            }
            if (effectiveAuthType && effectiveAuthType !== 'none') {
                debugLog.push({ type: 'info', message: `Auth: ${effectiveAuthType}${authSource !== request ? ' (inherited from collection)' : ''}`, timestamp: Date.now() });
            }

            // Parse body if it's a string (with variable resolution)
            let body = null;
            if (request.method !== 'GET' && request.method !== 'HEAD') {
                const bodyContent = request.body?.content;
                if (bodyContent) {
                    const resolvedBody = resolveVariables(bodyContent);
                    try {
                        body = JSON.parse(resolvedBody);
                    } catch {
                        body = resolvedBody; // Send as-is if not valid JSON
                    }
                    debugLog.push({ type: 'info', message: `Body: ${typeof body === 'object' ? JSON.stringify(body).slice(0, 200) : String(body).slice(0, 200)}`, timestamp: Date.now() });
                }
            }

            let responseData;
            let elapsed;

            if (localMode) {
                // --- Local Mode: direct browser fetch (enables localhost testing) ---
                try {
                    const fetchHeaders = { ...headers };
                    if (!fetchHeaders['Content-Type']) fetchHeaders['Content-Type'] = 'application/json';
                    const fetchOpts = {
                        method: request.method || 'GET',
                        headers: fetchHeaders,
                    };
                    if (body && request.method !== 'GET' && request.method !== 'HEAD') {
                        fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
                    }
                    const directRes = await fetch(resolvedUrl, fetchOpts);
                    elapsed = Date.now() - startTime;

                    let resData;
                    const contentType = directRes.headers.get('content-type') || '';
                    const resText = await directRes.text();
                    if (contentType.includes('json')) {
                        try { resData = JSON.parse(resText); } catch { resData = resText; }
                    } else {
                        resData = resText;
                    }

                    // Collect response headers
                    const resHeaders = {};
                    directRes.headers.forEach((v, k) => { resHeaders[k] = v; });

                    const success = directRes.status >= 200 && directRes.status < 300;
                    responseData = {
                        status: directRes.status,
                        statusText: directRes.statusText || (success ? 'OK' : 'Error'),
                        data: resData,
                        headers: resHeaders,
                        success,
                    };
                    setResponseData(tabId, responseData, elapsed);
                    addRequestHistory({
                        name: request.name, method: request.method, url: resolvedUrl,
                        status: directRes.status, time: elapsed, success
                    });
                } catch (fetchErr) {
                    elapsed = Date.now() - startTime;
                    const isCors = fetchErr.message?.includes('Failed to fetch') || fetchErr.name === 'TypeError';
                    responseData = {
                        status: 0,
                        statusText: 'Network Error',
                        data: isCors
                            ? `CORS Error: The server at ${resolvedUrl} did not allow this request.\n\nFix: Add CORS headers to your dev server (e.g. Access-Control-Allow-Origin: *).\nAlternative: Disable Local Mode to route through the cloud proxy.`
                            : `Direct request failed: ${fetchErr.message}`,
                        success: false,
                    };
                    setResponseData(tabId, responseData, elapsed);
                    addRequestHistory({
                        name: request.name, method: request.method, url: resolvedUrl,
                        status: 0, time: elapsed, success: false
                    });
                }
            } else {
                // --- Cloud Proxy Mode: route through backend /proxy ---
                const proxyRes = await authFetch(`${API_BASE}/proxy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: resolvedUrl,
                        method: request.method || 'GET',
                        headers: { 'Content-Type': 'application/json', ...headers },
                        body: body
                    })
                });

                const result = await proxyRes.json();
                elapsed = Date.now() - startTime;

                if (proxyRes.ok) {
                    const success = result.status >= 200 && result.status < 300;
                    responseData = {
                        status: result.status,
                        statusText: result.statusText,
                        data: result.data,
                        headers: result.headers,
                        success
                    };
                    setResponseData(tabId, responseData, elapsed);
                    addRequestHistory({
                        name: request.name, method: request.method, url: resolvedUrl,
                        status: result.status, time: elapsed, success
                    });
                } else {
                    responseData = {
                        status: proxyRes.status,
                        statusText: 'Proxy Error',
                        data: result.detail || result,
                        success: false
                    };
                    setResponseData(tabId, responseData, elapsed);
                    addRequestHistory({
                        name: request.name, method: request.method, url: resolvedUrl,
                        status: proxyRes.status, time: elapsed, success: false
                    });
                }
            }

            // --- Run Request Post-response Script ---
            let postResult = null;
            if (request.postScript?.trim()) {
                postResult = runPostResponseScript(request.postScript, {
                    variables: preResult?.updatedVars || { ...chainVars },
                    environment: getEnvVars(),
                    request: { ...request, url: resolvedUrl, resolvedHeaders: headers },
                    response: responseData,
                    responseTime: elapsed,
                });
                if (postResult.updatedVars) {
                    Object.entries(postResult.updatedVars).forEach(([k, v]) => {
                        if (chainVars[k] !== v) setChainVar(k, v);
                    });
                }
                if (postResult.updatedEnvVars) applyEnvVarChanges(postResult.updatedEnvVars);
            }

            // --- Run Collection Post-response Script ---
            let colPostResult = null;
            if (currentCol?.postScript?.trim()) {
                colPostResult = runPostResponseScript(currentCol.postScript, {
                    variables: postResult?.updatedVars || preResult?.updatedVars || { ...chainVars },
                    environment: getEnvVars(),
                    request: { ...request, url: resolvedUrl, resolvedHeaders: headers },
                    response: responseData,
                    responseTime: elapsed,
                });
                if (colPostResult.updatedVars) {
                    Object.entries(colPostResult.updatedVars).forEach(([k, v]) => {
                        if (chainVars[k] !== v) setChainVar(k, v);
                    });
                }
                if (colPostResult.updatedEnvVars) applyEnvVarChanges(colPostResult.updatedEnvVars);
            }

            setScriptResults({ pre: preResult, post: postResult, colPre: colPreResult, colPost: colPostResult });

            // Debug: response info
            debugLog.push({ type: responseData?.success ? 'info' : 'warn', message: `Response: ${responseData?.status} ${responseData?.statusText} (${elapsed}ms)`, timestamp: Date.now() });

            // Debug: script console logs
            [colPreResult, preResult, postResult, colPostResult].forEach(sr => {
                if (sr?.consoleLogs) sr.consoleLogs.forEach(l => debugLog.push({ type: 'info', message: `[script] ${l}`, timestamp: Date.now() }));
            });

            setDebugEntries(debugLog);

            // --- Evaluate Assertions ---
            if (request.assertions?.length > 0 && responseData) {
                const aResults = evaluateAssertions(request.assertions, responseData, elapsed);
                setAssertionResults(aResults);
            }
        } catch (err) {
            const elapsed = Date.now() - startTime;
            debugLog.push({ type: 'error', message: `Error: ${err.message}`, timestamp: Date.now() });
            setDebugEntries(debugLog);
            setResponseData(tabId, {
                status: 0,
                statusText: 'Connection Error',
                data: err.message || 'Failed to connect to backend. Is it running on port 8000?',
                success: false
            }, elapsed);
            addRequestHistory({
                name: request.name, method: request.method, url: resolvedUrl,
                status: 0, time: elapsed, success: false, error: err.message
            });
            setScriptResults({ pre: preResult, post: null });
        }
    };

    const handleChange = (field, value) => {
        updateRequest(tabId, { [field]: value });
    };

    // Two-way URL <-> Params sync
    const handleUrlInputChange = (newUrl) => {
        setLocalUrl(newUrl);
        const parsed = parseUrlParams(newUrl);
        updateRequest(tabId, { url: newUrl, params: parsed });
    };

    const handleParamsChange = (newParams) => {
        const newUrl = buildUrlWithParams(localUrl, newParams);
        setLocalUrl(newUrl);
        updateRequest(tabId, { url: newUrl, params: newParams });
    };

    // Generate cURL command from current request
    const generateCurl = () => {
        const resolvedUrl = resolveVariables(localUrl);
        let curl = `curl -X ${request.method || 'GET'} '${resolvedUrl}'`;

        // Add headers
        (request.headers || []).forEach(h => {
            if (h.enabled !== false && h.key) {
                curl += ` \\\n  -H '${resolveVariables(h.key)}: ${resolveVariables(h.value)}'`;
            }
        });

        // Add body
        if (request.method !== 'GET' && request.method !== 'HEAD') {
            const bodyContent = request.body?.content;
            if (bodyContent) {
                curl += ` \\\n  -H 'Content-Type: application/json'`;
                curl += ` \\\n  -d '${resolveVariables(bodyContent)}'`;
            }
        }

        return curl;
    };

    const handleCopyCurl = () => {
        navigator.clipboard.writeText(generateCurl());
    };

    const getStatusColor = (status) => {
        if (status >= 200 && status < 300) return 'text-green-600';
        if (status >= 400 && status < 500) return 'text-amber-600';
        if (status >= 500) return 'text-red-600';
        return 'text-slate-600 dark:text-slate-400';
    };

    const formatBytes = (str) => {
        const bytes = new Blob([typeof str === 'string' ? str : JSON.stringify(str)]).size;
        if (bytes < 1024) return `${bytes}B`;
        return `${(bytes / 1024).toFixed(1)}KB`;
    };

    if (!request) return null;

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 h-full relative font-sans">
            {/* Top Bar: URL & Method */}
            <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-3 bg-white dark:bg-slate-900 shadow-sm z-10">
                <div className="flex-1 flex items-center border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-corporate-500/20 focus-within:border-corporate-500 transition-all h-10">

                    <CustomMethodSelect
                        value={request.method}
                        onChange={(val) => handleChange('method', val)}
                    />

                    <input
                        type="text"
                        value={localUrl}
                        onChange={(e) => handleUrlInputChange(e.target.value)}
                        className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none placeholder-slate-400 dark:placeholder-slate-500 font-mono h-full"
                        placeholder="https://api.example.com/v1/resource"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleRun(); } }}
                    />
                </div>

                <button
                    onClick={() => setShowCodeGen(true)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 dark:text-slate-500 hover:text-corporate-600 transition-colors"
                    title="Generate Code"
                >
                    <Code2 size={16} />
                </button>

                <button
                    onClick={handleCopyCurl}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title="Copy as cURL"
                >
                    <Copy size={16} />
                </button>

                <button
                    data-run-btn="true"
                    onClick={handleRun}
                    disabled={loading}
                    className="bg-gradient-to-r from-corporate-600 to-corporate-500 hover:from-corporate-700 hover:to-corporate-600 disabled:from-corporate-300 disabled:to-corporate-300 text-white px-6 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-md shadow-corporate-200 dark:shadow-none transition-all active:scale-95 min-w-[100px] justify-center"
                    title="Send Request (Ctrl+Enter)"
                >
                    {loading ? (
                        <>
                            <Activity size={16} className="animate-spin" />
                            <span>Sending...</span>
                        </>
                    ) : (
                        <>
                            <Play size={16} className="fill-current" />
                            <span>Send</span>
                        </>
                    )}
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex overflow-hidden" ref={splitContainerRef}>
                {/* Left: Request Params/Body */}
                <div className="border-r border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-900" style={{ width: `${editorSplitRatio * 100}%` }}>
                    <div className="h-10 border-b border-slate-200 dark:border-slate-700 flex items-center px-1 text-xs font-semibold text-slate-500 dark:text-slate-400 overflow-x-auto scrollbar-hide shrink min-w-0">
                        {['params', 'headers', 'body', 'auth', 'scripts', 'assertions'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveSubTab(tab)}
                                className={`px-3 h-full whitespace-nowrap shrink-0 capitalize relative transition-colors
                            ${activeSubTab === tab ? 'text-corporate-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-corporate-600' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'}
                        `}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="flex-1 overflow-y-auto">
                        {activeSubTab === 'params' && (
                            <KeyValueEditor
                                items={request.params}
                                onChange={handleParamsChange}
                                placeholderKey="Query Param"
                            />
                        )}

                        {activeSubTab === 'headers' && (
                            <KeyValueEditor
                                items={request.headers}
                                onChange={(val) => handleChange('headers', val)}
                                placeholderKey="Header"
                            />
                        )}

                        {activeSubTab === 'body' && (
                            <div className="h-full flex flex-col">
                                <div className="p-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Raw JSON</span>
                                    <button
                                        onClick={() => {
                                            try {
                                                const current = request.body?.content || '';
                                                if (!current) return;
                                                const formatted = JSON.stringify(JSON.parse(current), null, 2);
                                                handleChange('body', { ...request.body, content: formatted });
                                            } catch {
                                                alert("Invalid JSON: Cannot beautify");
                                            }
                                        }}
                                        className="text-[10px] text-corporate-600 hover:underline"
                                    >
                                        Beautify
                                    </button>
                                </div>
                                <textarea
                                    className="flex-1 w-full p-4 font-mono text-xs text-slate-700 dark:text-slate-300 resize-none outline-none focus:bg-slate-50/30 bg-white dark:bg-slate-900"
                                    placeholder="{}"
                                    value={request.body?.content || ''}
                                    onChange={(e) => handleChange('body', { ...request.body, content: e.target.value })}
                                    onKeyDown={(e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleRun(); } }}
                                />
                            </div>
                        )}

                        {activeSubTab === 'auth' && (() => {
                            const authCol = collections.find(c => c.id === activeCollectionId);
                            const isForced = authCol?.forceCollectionAuth && authCol?.authType && authCol.authType !== 'none';
                            const AUTH_LABELS = { bearer: 'Bearer Token', basic: 'Basic Auth', apikey: 'API Key', 'auto-auth': 'Auto-Auth' };
                            return (
                            <div className="p-4">
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Authorization</div>

                                {isForced && (
                                    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-300 uppercase">From Collection</span>
                                            <span className="text-[10px] bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 px-1.5 py-0.5 rounded font-semibold">
                                                {AUTH_LABELS[authCol.authType] || authCol.authType}
                                            </span>
                                        </div>
                                        <p className="text-[10px] text-amber-600 dark:text-amber-400">
                                            Collection auth is forced on all requests. Values come from collection settings.
                                        </p>
                                        {authCol.authType === 'bearer' && authCol.authToken && (
                                            <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-amber-200 dark:border-amber-700">
                                                <span className="text-[9px] text-slate-500 dark:text-slate-400">Token:</span>
                                                <code className="text-[10px] text-slate-700 dark:text-slate-300 break-all block mt-0.5 font-mono">
                                                    {authCol.authToken.length > 60 ? authCol.authToken.slice(0, 60) + '...' : authCol.authToken}
                                                </code>
                                            </div>
                                        )}
                                        {authCol.authType === 'basic' && (
                                            <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-amber-200 dark:border-amber-700 text-[10px] text-slate-700 dark:text-slate-300">
                                                User: <code className="font-mono">{authCol.authUsername || '(empty)'}</code>
                                            </div>
                                        )}
                                        {authCol.authType === 'apikey' && (
                                            <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-amber-200 dark:border-amber-700 text-[10px] text-slate-700 dark:text-slate-300">
                                                Header: <code className="font-mono">{authCol.authKeyName || 'X-API-Key'}</code> = <code className="font-mono">{authCol.authKeyValue ? (authCol.authKeyValue.length > 30 ? authCol.authKeyValue.slice(0, 30) + '...' : authCol.authKeyValue) : '(empty)'}</code>
                                            </div>
                                        )}
                                        {authCol.authType === 'auto-auth' && authCol.autoAuthToken && (
                                            <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-amber-200 dark:border-amber-700 text-[10px] text-green-700 dark:text-green-400">
                                                Auto-Auth token cached
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex items-center gap-2 mb-3">
                                    <select
                                        value={request.authType || 'none'}
                                        onChange={(e) => handleChange('authType', e.target.value)}
                                        disabled={isForced}
                                        className={`text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-corporate-500 text-slate-700 dark:text-slate-300 ${isForced ? 'opacity-50' : ''}`}
                                    >
                                        <option value="none">No Auth</option>
                                        <option value="inherit">Inherit from Collection</option>
                                        <option value="bearer">Bearer Token</option>
                                        <option value="basic">Basic Auth</option>
                                        <option value="apikey">API Key</option>
                                        <option value="auto-auth">Auto-Auth (Login → Token)</option>
                                    </select>
                                    {isForced && <span className="text-[10px] text-amber-600 dark:text-amber-400 italic">Overridden by collection</span>}
                                </div>

                                {request.authType === 'inherit' && !isForced && (
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 italic">
                                        This request will use the auth configured on its parent collection.
                                    </p>
                                )}

                                {request.authType === 'bearer' && (
                                    <div>
                                        <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 block">Token</label>
                                        <textarea
                                            value={request.authToken || ''}
                                            onChange={(e) => handleChange('authToken', e.target.value)}
                                            placeholder="Paste your Bearer token here or use {{token_var}}"
                                            className="w-full text-xs font-mono p-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none focus:ring-1 focus:ring-corporate-500 resize-none text-slate-700 dark:text-slate-300"
                                            rows={3}
                                        />
                                        {!request.authToken?.trim() && (
                                            <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                                <AlertCircle size={10} /> Token is empty — no Authorization header will be sent
                                            </p>
                                        )}
                                        {request.authToken?.trim() && (
                                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Token will be sent as <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Authorization: Bearer &lt;token&gt;</code></p>
                                        )}
                                    </div>
                                )}

                                {request.authType === 'basic' && (
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 block">Username</label>
                                            <input
                                                type="text"
                                                value={request.authUsername || ''}
                                                onChange={(e) => handleChange('authUsername', e.target.value)}
                                                placeholder="username"
                                                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none focus:ring-1 focus:ring-corporate-500 text-slate-700 dark:text-slate-300"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 block">Password</label>
                                            <input
                                                type="password"
                                                value={request.authPassword || ''}
                                                onChange={(e) => handleChange('authPassword', e.target.value)}
                                                placeholder="password"
                                                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none focus:ring-1 focus:ring-corporate-500 text-slate-700 dark:text-slate-300"
                                            />
                                        </div>
                                    </div>
                                )}

                                {request.authType === 'apikey' && (
                                    <div className="space-y-2">
                                        <div>
                                            <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 block">Header Name</label>
                                            <input
                                                type="text"
                                                value={request.authKeyName || 'X-API-Key'}
                                                onChange={(e) => handleChange('authKeyName', e.target.value)}
                                                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none focus:ring-1 focus:ring-corporate-500 text-slate-700 dark:text-slate-300"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 dark:text-slate-400 mb-1 block">API Key Value</label>
                                            <input
                                                type="text"
                                                value={request.authKeyValue || ''}
                                                onChange={(e) => handleChange('authKeyValue', e.target.value)}
                                                placeholder="Your API key or use {{api_key}}"
                                                className="w-full text-xs font-mono px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 outline-none focus:ring-1 focus:ring-corporate-500 text-slate-700 dark:text-slate-300"
                                            />
                                            {!request.authKeyValue?.trim() && (
                                                <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                                    <AlertCircle size={10} /> Key value is empty — no API key header will be sent
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {request.authType === 'auto-auth' && (
                                    <AutoAuthPanel request={request} handleChange={handleChange} />
                                )}

                                {(!request.authType || request.authType === 'none') && !isForced && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500">No authorization headers will be added to this request.</p>
                                )}
                            </div>
                            );
                        })()}

                        {activeSubTab === 'scripts' && (
                            <div className="h-full flex flex-col p-4 gap-4">
                                {/* Pre-request Script */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pre-request Script</span>
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500">Runs before the request is sent</span>
                                    </div>
                                    <textarea
                                        className="flex-1 w-full p-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg resize-none outline-none focus:ring-2 focus:ring-corporate-500"
                                        placeholder={`// Pre-request script (JavaScript)\n// Available: pm.variables.set(k,v), pm.variables.get(k)\n// pm.environment.set(k,v), pm.environment.get(k)\n\nconsole.log("Running pre-request...");`}
                                        value={request.preScript || ''}
                                        onChange={(e) => handleChange('preScript', e.target.value)}
                                    />
                                </div>
                                {/* Post-response Script */}
                                <div className="flex-1 flex flex-col min-h-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Post-response Script</span>
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500">Runs after the response is received</span>
                                    </div>
                                    <textarea
                                        className="flex-1 w-full p-3 font-mono text-[11px] text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg resize-none outline-none focus:ring-2 focus:ring-corporate-500"
                                        placeholder={`// Post-response script (JavaScript)\n// Available: pm.response.json(), pm.response.status\n// pm.response.time, pm.test(name, fn)\n\npm.test("Status is 200", () => {\n  if (pm.response.status !== 200) throw new Error("Expected 200");\n});`}
                                        value={request.postScript || ''}
                                        onChange={(e) => handleChange('postScript', e.target.value)}
                                    />
                                </div>
                                <div className="text-[9px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800 rounded p-2 border border-slate-200 dark:border-slate-700">
                                    <strong>Available APIs:</strong> pm.variables.set/get, pm.environment.set/get, pm.response.json(), pm.response.status, pm.response.time, pm.test(name, fn), console.log()
                                </div>
                            </div>
                        )}

                        {activeSubTab === 'assertions' && (
                            <div className="p-4">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                                        Response Assertions ({(request.assertions || []).length})
                                    </span>
                                    <button
                                        onClick={() => {
                                            const newA = createAssertion('status_code');
                                            handleChange('assertions', [...(request.assertions || []), newA]);
                                        }}
                                        className="text-[10px] font-bold text-corporate-600 dark:text-corporate-400 hover:text-corporate-700 dark:hover:text-corporate-300 transition-colors"
                                    >
                                        + Add Assertion
                                    </button>
                                </div>

                                {(request.assertions || []).length === 0 ? (
                                    <div className="text-center py-8 text-slate-300 dark:text-slate-600">
                                        <CheckCircle size={24} className="mx-auto mb-2 opacity-40" />
                                        <p className="text-xs text-slate-400 dark:text-slate-500">No assertions yet. Add one to validate responses automatically.</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {(request.assertions || []).map((assertion, idx) => (
                                            <div
                                                key={assertion.id}
                                                className={`border rounded-lg p-3 transition-colors ${assertion.enabled !== false
                                                    ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
                                                    : 'border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 opacity-60'
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 mb-2">
                                                    {/* Enable toggle */}
                                                    <button
                                                        onClick={() => {
                                                            const updated = [...(request.assertions || [])];
                                                            updated[idx] = { ...updated[idx], enabled: !(updated[idx].enabled !== false) };
                                                            handleChange('assertions', updated);
                                                        }}
                                                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${assertion.enabled !== false
                                                            ? 'border-corporate-500 bg-corporate-500 text-white'
                                                            : 'border-slate-300 dark:border-slate-600'
                                                            }`}
                                                    >
                                                        {assertion.enabled !== false && <CheckCircle size={10} />}
                                                    </button>

                                                    {/* Type selector */}
                                                    <select
                                                        value={assertion.type}
                                                        onChange={(e) => {
                                                            const newA = createAssertion(e.target.value);
                                                            const updated = [...(request.assertions || [])];
                                                            updated[idx] = { ...newA, id: assertion.id, enabled: assertion.enabled };
                                                            handleChange('assertions', updated);
                                                        }}
                                                        className="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 outline-none text-slate-700 dark:text-slate-300"
                                                    >
                                                        <option value="status_code">Status Code</option>
                                                        <option value="response_time">Response Time</option>
                                                        <option value="body_contains">Body Contains</option>
                                                        <option value="body_not_contains">Body Not Contains</option>
                                                        <option value="json_path">JSON Path</option>
                                                        <option value="header_contains">Header Contains</option>
                                                        <option value="body_json_schema">JSON Schema</option>
                                                    </select>

                                                    <div className="flex-1" />

                                                    {/* Delete */}
                                                    <button
                                                        onClick={() => {
                                                            handleChange('assertions', (request.assertions || []).filter((_, i) => i !== idx));
                                                        }}
                                                        className="text-slate-400 hover:text-red-500 transition-colors p-0.5"
                                                    >
                                                        <AlertCircle size={12} />
                                                    </button>
                                                </div>

                                                {/* Assertion fields based on type */}
                                                <div className={`flex ${assertion.type === 'body_json_schema' ? 'flex-col' : 'items-center'} gap-2 text-[10px]`}>
                                                    {(assertion.type === 'json_path' || assertion.type === 'header_contains') && (
                                                        <input
                                                            type="text"
                                                            value={assertion.target || ''}
                                                            onChange={(e) => {
                                                                const updated = [...(request.assertions || [])];
                                                                updated[idx] = { ...updated[idx], target: e.target.value };
                                                                handleChange('assertions', updated);
                                                            }}
                                                            placeholder={assertion.type === 'json_path' ? 'e.g. data.id' : 'e.g. content-type'}
                                                            className="flex-1 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400"
                                                        />
                                                    )}

                                                    {(assertion.type === 'status_code' || assertion.type === 'response_time' || assertion.type === 'json_path') && (
                                                        <select
                                                            value={assertion.comparison || 'equals'}
                                                            onChange={(e) => {
                                                                const updated = [...(request.assertions || [])];
                                                                updated[idx] = { ...updated[idx], comparison: e.target.value };
                                                                handleChange('assertions', updated);
                                                            }}
                                                            className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-1 outline-none text-slate-700 dark:text-slate-300"
                                                        >
                                                            <option value="equals">equals</option>
                                                            <option value="not_equals">not equals</option>
                                                            <option value="greater_than">greater than</option>
                                                            <option value="less_than">less than</option>
                                                            <option value="greater_than_or_equal">gte</option>
                                                            <option value="less_than_or_equal">lte</option>
                                                            <option value="contains">contains</option>
                                                            <option value="not_contains">not contains</option>
                                                            <option value="starts_with">starts with</option>
                                                            <option value="ends_with">ends with</option>
                                                            <option value="matches_regex">matches regex</option>
                                                            {assertion.type === 'json_path' && <option value="exists">exists</option>}
                                                            {assertion.type === 'json_path' && <option value="is_type">is type</option>}
                                                            {assertion.type === 'json_path' && <option value="is_empty">is empty</option>}
                                                            {assertion.type === 'json_path' && <option value="is_not_empty">is not empty</option>}
                                                            {assertion.type === 'json_path' && <option value="is_null">is null</option>}
                                                            {assertion.type === 'json_path' && <option value="is_not_null">is not null</option>}
                                                            {assertion.type === 'json_path' && <option value="length_equals">length equals</option>}
                                                            {assertion.type === 'json_path' && <option value="length_greater_than">length &gt;</option>}
                                                            {assertion.type === 'json_path' && <option value="length_less_than">length &lt;</option>}
                                                        </select>
                                                    )}

                                                    {assertion.type === 'body_json_schema' ? (
                                                        <textarea
                                                            value={assertion.expected || ''}
                                                            onChange={(e) => {
                                                                const updated = [...(request.assertions || [])];
                                                                updated[idx] = { ...updated[idx], expected: e.target.value };
                                                                handleChange('assertions', updated);
                                                            }}
                                                            placeholder='{"type":"object","required":["id","name"],"properties":{"id":{"type":"number"}}}'
                                                            rows={3}
                                                            className="w-full font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400 resize-none"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={assertion.expected || ''}
                                                            onChange={(e) => {
                                                                const updated = [...(request.assertions || [])];
                                                                updated[idx] = { ...updated[idx], expected: e.target.value };
                                                                handleChange('assertions', updated);
                                                            }}
                                                            placeholder={
                                                                assertion.type === 'status_code' ? '200' :
                                                                    assertion.type === 'response_time' ? '2000' :
                                                                        'expected value'
                                                            }
                                                            className="flex-1 font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 outline-none text-slate-700 dark:text-slate-300 placeholder-slate-400"
                                                        />
                                                    )}
                                                </div>

                                                {/* Result indicator (if evaluated) */}
                                                {assertionResults && (() => {
                                                    const r = assertionResults.results.find(r => r.id === assertion.id);
                                                    if (!r) return null;
                                                    return (
                                                        <div className={`mt-2 text-[10px] flex items-center gap-1 ${r.passed ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                            {r.passed ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                                                            {r.message}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Quick add buttons */}
                                <div className="mt-3 flex flex-wrap gap-1">
                                    {['status_code', 'response_time', 'json_path', 'body_contains', 'header_contains', 'body_json_schema'].map(type => (
                                        <button
                                            key={type}
                                            onClick={() => {
                                                const newA = createAssertion(type);
                                                handleChange('assertions', [...(request.assertions || []), newA]);
                                            }}
                                            className="text-[9px] text-slate-400 dark:text-slate-500 hover:text-corporate-600 dark:hover:text-corporate-400 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 transition-colors"
                                        >
                                            + {type.replace('_', ' ')}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <ResizeHandle onResize={handleEditorSplitResize} />

                {/* Right: Response */}
                <div className="flex-1 flex flex-col bg-slate-50 dark:bg-slate-800 min-w-0">
                    <div className="h-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-1 text-xs font-semibold text-slate-500 dark:text-slate-400 justify-between">
                        <div className="flex items-center gap-1 h-full overflow-x-auto scrollbar-hide shrink min-w-0">
                            {['body', 'headers', ...(scriptResults ? ['tests'] : []), ...(assertionResults?.total > 0 ? ['assertions'] : []), ...(debugEntries.length > 0 ? ['console'] : [])].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setResponseTab(tab)}
                                    className={`px-3 h-full text-xs font-semibold capitalize relative transition-colors whitespace-nowrap shrink-0 ${responseTab === tab
                                        ? 'text-corporate-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-corporate-600'
                                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                        }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        {response && (
                            <div className="flex gap-3 items-center pr-3 shrink-0 ml-2">
                                <span className={`font-bold whitespace-nowrap ${getStatusColor(response.status)}`}>
                                    {response.status} {response.statusText}
                                </span>
                                {responseTime && (
                                    <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                        <Clock size={10} />
                                        {responseTime}ms
                                    </span>
                                )}
                                {response.data && (
                                    <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                        <FileText size={10} />
                                        {formatBytes(response.data)}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-700 dark:text-slate-300">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-corporate-500">
                                <Activity className="mb-2 animate-spin" size={32} />
                                <span>Sending request...</span>
                            </div>
                        ) : response ? (
                            responseTab === 'tests' && scriptResults ? (
                                /* Script Tests View */
                                <div className="space-y-4">
                                    {/* Test Results */}
                                    {(() => {
                                        const allTests = [
                                            ...(scriptResults.pre?.testResults || []),
                                            ...(scriptResults.post?.testResults || []),
                                        ];
                                        const passed = allTests.filter(t => t.passed).length;
                                        const failed = allTests.filter(t => !t.passed).length;
                                        return allTests.length > 0 ? (
                                            <div>
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Test Results</span>
                                                    <span className="text-[10px] text-green-600 font-bold">{passed} passed</span>
                                                    {failed > 0 && <span className="text-[10px] text-red-600 font-bold">{failed} failed</span>}
                                                </div>
                                                <div className="space-y-1">
                                                    {allTests.map((t, i) => (
                                                        <div key={i} className={`flex items-center gap-2 p-2 rounded text-xs ${t.passed ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                                                            {t.passed ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                                                            <span className="font-medium">{t.name}</span>
                                                            {t.error && <span className="text-[10px] opacity-75 ml-auto">{t.error}</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-400 dark:text-slate-500">No pm.test() assertions found in scripts.</div>
                                        );
                                    })()}

                                    {/* Console Output */}
                                    {(() => {
                                        const allLogs = [
                                            ...(scriptResults.pre?.consoleLogs || []).map(l => ({ phase: 'pre', msg: l })),
                                            ...(scriptResults.post?.consoleLogs || []).map(l => ({ phase: 'post', msg: l })),
                                        ];
                                        return allLogs.length > 0 && (
                                            <div>
                                                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-1 block">Console Output</span>
                                                <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-3 font-mono text-[11px] text-green-400 max-h-48 overflow-auto">
                                                    {allLogs.map((log, i) => (
                                                        <div key={i} className="flex gap-2">
                                                            <span className="text-slate-500 select-none">[{log.phase}]</span>
                                                            <span>{log.msg}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })()}

                                    {/* Script Errors */}
                                    {scriptResults.pre?.error && (
                                        <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
                                            <span className="font-bold">Pre-script error:</span> {scriptResults.pre.error}
                                        </div>
                                    )}
                                    {scriptResults.post?.error && (
                                        <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-xs text-red-700 dark:text-red-400">
                                            <span className="font-bold">Post-script error:</span> {scriptResults.post.error}
                                        </div>
                                    )}
                                </div>
                            ) : responseTab === 'assertions' && assertionResults ? (
                                /* Assertion Results View */
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">Assertion Results</span>
                                        <span className="text-[10px] text-green-600 font-bold">{assertionResults.passed} passed</span>
                                        {assertionResults.failed > 0 && <span className="text-[10px] text-red-600 font-bold">{assertionResults.failed} failed</span>}
                                        <span className="text-[10px] text-slate-400">/ {assertionResults.total} total</span>
                                    </div>
                                    {assertionResults.results.map((r, i) => (
                                        <div key={r.id || i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs border ${r.passed
                                            ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400'
                                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'
                                            }`}>
                                            {r.passed ? <CheckCircle size={12} className="shrink-0 mt-0.5" /> : <AlertCircle size={12} className="shrink-0 mt-0.5" />}
                                            <div>
                                                <div className="font-medium">{r.name}</div>
                                                <div className="text-[10px] opacity-75 mt-0.5">{r.message}</div>
                                            </div>
                                        </div>
                                    ))}
                                    {assertionResults.total === 0 && (
                                        <p className="text-xs text-slate-400 dark:text-slate-500">No enabled assertions to evaluate.</p>
                                    )}
                                </div>
                            ) : responseTab === 'headers' ? (
                                /* Response Headers View */
                                <div>
                                    {response.headers && typeof response.headers === 'object' ? (
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="text-[10px] text-slate-400 dark:text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                                                    <th className="text-left pb-2 pr-4">Header</th>
                                                    <th className="text-left pb-2">Value</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(response.headers).map(([key, value]) => (
                                                    <tr key={key} className="border-b border-slate-100 dark:border-slate-800">
                                                        <td className="py-1.5 pr-4 text-slate-600 dark:text-slate-400 font-semibold">{key}</td>
                                                        <td className="py-1.5 text-slate-500 dark:text-slate-400 break-all">{value}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    ) : (
                                        <p className="text-slate-400 dark:text-slate-500">No response headers available.</p>
                                    )}
                                </div>
                            ) : responseTab === 'console' && debugEntries.length > 0 ? (
                                /* Debug Console */
                                <div className="bg-slate-900 rounded-lg border border-slate-700 overflow-hidden">
                                    <div className="px-3 py-1.5 bg-slate-800 border-b border-slate-700 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">Debug Console</span>
                                        <span className="text-[9px] text-slate-500">{debugEntries.length} entries</span>
                                    </div>
                                    <div className="max-h-[350px] overflow-auto p-2 space-y-0.5 font-mono text-[10px]">
                                        {debugEntries.map((entry, idx) => (
                                            <div key={idx} className="flex items-start gap-2">
                                                <span className="text-slate-600 shrink-0 w-16">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                                                <span className={`${
                                                    entry.type === 'error' ? 'text-red-400' :
                                                    entry.type === 'warn' ? 'text-amber-400' :
                                                    'text-green-400'
                                                }`}>
                                                    {entry.message}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                /* Response Body View */
                                <div>
                                    {response.success === false && (
                                        <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded flex items-center gap-2 text-red-700 dark:text-red-400">
                                            <AlertCircle size={14} />
                                            <span>Request failed</span>
                                        </div>
                                    )}
                                    {response.success === true && (
                                        <div className="mb-3 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded flex items-center gap-2 text-green-700 dark:text-green-400">
                                            <CheckCircle size={14} />
                                            <span>Request successful</span>
                                        </div>
                                    )}
                                    {/* JSON/Table toggle */}
                                    {Array.isArray(response.data) && response.data.length > 0 && typeof response.data[0] === 'object' && (
                                        <div className="flex items-center gap-1 mb-2">
                                            <button
                                                onClick={() => setResponseViewMode('json')}
                                                className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${responseViewMode === 'json' ? 'bg-corporate-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                            >
                                                JSON
                                            </button>
                                            <button
                                                onClick={() => setResponseViewMode('table')}
                                                className={`text-[10px] px-2 py-0.5 rounded font-medium transition-colors ${responseViewMode === 'table' ? 'bg-corporate-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}
                                            >
                                                Table
                                            </button>
                                        </div>
                                    )}
                                    {responseViewMode === 'table' && Array.isArray(response.data) && response.data.length > 0 && typeof response.data[0] === 'object' ? (
                                        <TableViewer data={response.data} />
                                    ) : (
                                        <JsonViewer
                                            data={response.data}
                                            language={typeof response.data === 'object' ? 'json' : 'text'}
                                            maxHeight="350px"
                                        />
                                    )}

                                    {/* Extract Variable — Chain Requests */}
                                    {response.data && typeof response.data === 'object' && (
                                        <div className="mt-4 p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                                            <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">
                                                <Link size={10} />
                                                Extract to Variable
                                            </div>
                                            <div className="flex gap-2 items-center">
                                                <input
                                                    type="text"
                                                    value={extractPath}
                                                    onChange={(e) => setExtractPath(e.target.value)}
                                                    placeholder="path (e.g. data.token)"
                                                    className="flex-1 text-[11px] font-mono px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded outline-none focus:ring-1 focus:ring-corporate-500 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                                />
                                                <span className="text-slate-400 dark:text-slate-500 text-[10px]">as</span>
                                                <input
                                                    type="text"
                                                    value={extractName}
                                                    onChange={(e) => setExtractName(e.target.value)}
                                                    placeholder="var_name"
                                                    className="w-28 text-[11px] font-mono px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded outline-none focus:ring-1 focus:ring-corporate-500 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                                                    onKeyDown={(e) => { if (e.key === 'Enter') handleExtractVar(); }}
                                                />
                                                <button
                                                    onClick={handleExtractVar}
                                                    disabled={!extractPath.trim() || !extractName.trim()}
                                                    className="px-3 py-1.5 text-[10px] font-bold bg-corporate-600 hover:bg-corporate-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded transition-colors"
                                                >
                                                    Save
                                                </button>
                                            </div>
                                            {extractFeedback && (
                                                <div className={`mt-2 text-[10px] ${extractFeedback.ok ? 'text-green-600' : 'text-red-600'}`}>
                                                    {extractFeedback.msg}
                                                </div>
                                            )}
                                            {Object.keys(chainVars).length > 0 && (
                                                <div className="mt-2 flex flex-wrap gap-1">
                                                    {Object.entries(chainVars).map(([k]) => (
                                                        <span key={k} className="text-[9px] bg-corporate-50 dark:bg-corporate-900/30 text-corporate-700 dark:text-corporate-400 border border-corporate-200 rounded px-1.5 py-0.5 font-mono">
                                                            {`{{${k}}}`}
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                                <Activity className="mb-2 opacity-20" size={32} />
                                <span>Enter a URL and click Send</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* Code Gen Modal */}
            {showCodeGen && <CodeGenModal request={request} onClose={() => setShowCodeGen(false)} />}
        </div>
    );
};
