import React, { useState, useCallback } from 'react';
import { Play, X, Activity, CheckCircle, XCircle, Clock, Zap, BarChart3, ArrowDown, ArrowUp, FileText, History, Sparkles, ToggleLeft, ToggleRight, Stethoscope, Lightbulb, AlertTriangle } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { runPreRequestScript, runPostResponseScript } from '../../utils/scriptEngine';

import { API_BASE, authFetch } from '../../config';

const METHOD_COLORS = {
    GET: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20',
    POST: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20',
    PUT: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
    DELETE: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/20',
    PATCH: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/20',
};

const IMPACT_COLORS = {
    High: 'text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
    Medium: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800',
    Low: 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800',
};

export const CollectionRunner = () => {
    const runner = useWorkspaceStore(state => state.runner);
    const collections = useWorkspaceStore(state => state.collections);
    const closeRunner = useWorkspaceStore(state => state.closeRunner);
    const setRunnerState = useWorkspaceStore(state => state.setRunnerState);
    const saveRunToCollection = useWorkspaceStore(state => state.saveRunToCollection);
    const resolveVariables = useWorkspaceStore(state => state.resolveVariables);
    const chainVars = useWorkspaceStore(state => state.chainVars);
    const setChainVar = useWorkspaceStore(state => state.setChainVar);
    const environments = useWorkspaceStore(state => state.environments);
    const activeEnv = useWorkspaceStore(state => state.activeEnv);
    const updateRequest = useWorkspaceStore(state => state.updateRequest);
    const localMode = useWorkspaceStore(state => state.localMode);

    const [isRunning, setIsRunning] = useState(false);
    const [parallel, setParallel] = useState(false);
    const [optimizations, setOptimizations] = useState([]);
    const [diagnoses, setDiagnoses] = useState({});
    const [diagnosing, setDiagnosing] = useState({});
    const [expandedRow, setExpandedRow] = useState(null);

    const handleDiagnose = async (result) => {
        if (diagnosing[result.id]) return;
        setDiagnosing(prev => ({ ...prev, [result.id]: true }));
        try {
            const res = await authFetch(`${API_BASE}/diagnose`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: result.method,
                    url: result.url,
                    expected_status: result.expected_status || 200,
                    actual_status: result.status,
                    response_body: typeof result.responseBody === 'string' ? result.responseBody : JSON.stringify(result.responseBody || ''),
                })
            });
            const data = await res.json();
            setDiagnoses(prev => ({ ...prev, [result.id]: data }));
        } catch (err) {
            setDiagnoses(prev => ({ ...prev, [result.id]: { error: err.message } }));
        } finally {
            setDiagnosing(prev => ({ ...prev, [result.id]: false }));
        }
    };

    // Helper: get current environment vars array
    const getEnvVars = useCallback(() => {
        const globalEnv = environments.find(e => e.name === 'Global');
        const activeEnvObj = environments.find(e => e.name === activeEnv);
        const vars = [...(globalEnv?.vars || [])];
        if (activeEnvObj && activeEnvObj.name !== 'Global') {
            vars.push(...(activeEnvObj.vars || []));
        }
        return vars;
    }, [environments, activeEnv]);

    /**
     * Get the effective auth config for a request.
     * If the request has its own auth (authType !== 'none' and not empty), use it.
     * Otherwise, inherit from the collection's auth settings.
     */
    const getEffectiveAuth = (req, col) => {
        // Check if request has its own auth configured
        const hasOwnAuth = req.authType && req.authType !== 'none' && req.authType !== 'inherit';
        if (hasOwnAuth) {
            return {
                type: req.authType,
                token: req.authToken,
                username: req.authUsername,
                password: req.authPassword,
                keyName: req.authKeyName,
                keyValue: req.authKeyValue,
                // Auto-auth fields
                autoAuthLoginUrl: req.autoAuthLoginUrl,
                autoAuthMethod: req.autoAuthMethod,
                autoAuthBody: req.autoAuthBody,
                autoAuthTokenPath: req.autoAuthTokenPath,
                autoAuthLoginHeaders: req.autoAuthLoginHeaders,
                autoAuthToken: req.autoAuthToken,
                autoAuthTokenTime: req.autoAuthTokenTime,
            };
        }

        // Inherit from collection
        if (col?.authType && col.authType !== 'none') {
            return {
                type: col.authType,
                token: col.authToken,
                username: col.authUsername,
                password: col.authPassword,
                keyName: col.authKeyName,
                keyValue: col.authKeyValue,
                autoAuthLoginUrl: col.autoAuthLoginUrl,
                autoAuthMethod: col.autoAuthMethod,
                autoAuthBody: col.autoAuthBody,
                autoAuthTokenPath: col.autoAuthTokenPath,
                autoAuthLoginHeaders: col.autoAuthLoginHeaders,
                autoAuthToken: col.autoAuthToken,
                autoAuthTokenTime: col.autoAuthTokenTime,
            };
        }

        return { type: 'none' };
    };

    // Sequential execution via /proxy (supports request chaining + scripts)
    const runSequential = useCallback(async () => {
        if (!runner || isRunning) return;
        const requests = runner.requests;
        if (requests.length === 0) return;

        setIsRunning(true);
        setRunnerState({ running: true, progress: 0, results: [], summary: null });
        setOptimizations([]);

        const results = [];
        const startTotal = Date.now();
        // Local copy of chain vars for script chaining across requests
        let runningVars = { ...chainVars };

        for (let i = 0; i < requests.length; i++) {
            const req = requests[i];
            setRunnerState({ progress: i });

            const startTime = Date.now();
            let result;
            let scriptTestResults = [];

            try {
                // --- Run Pre-request Script ---
                if (req.preScript?.trim()) {
                    const preResult = runPreRequestScript(req.preScript, {
                        variables: runningVars,
                        environment: getEnvVars(),
                        request: req,
                    });
                    if (preResult.updatedVars) {
                        runningVars = { ...runningVars, ...preResult.updatedVars };
                        Object.entries(preResult.updatedVars).forEach(([k, v]) => setChainVar(k, v));
                    }
                    scriptTestResults.push(...(preResult.testResults || []));
                    if (!preResult.success) {
                        result = {
                            id: req.id, name: req.name, method: req.method, url: req.url,
                            status: 0, statusText: 'Pre-script Error', time: Date.now() - startTime,
                            size: 0, success: false, error: `Pre-script: ${preResult.error}`,
                            expected_status: req.expected_status, category: req.category,
                            scriptTests: scriptTestResults,
                        };
                        results.push(result);
                        setRunnerState({ results: [...results], progress: i + 1 });
                        continue;
                    }
                }

                const resolvedUrl = resolveVariables(req.url);
                const headers = {};
                (req.headers || []).forEach(h => {
                    if (h.enabled !== false && h.key) headers[resolveVariables(h.key)] = resolveVariables(h.value);
                });

                // Apply auth headers (with collection-level inheritance)
                const currentCol = collections.find(c => c.id === runner.collectionId);
                const effectiveAuth = getEffectiveAuth(req, currentCol);
                if (effectiveAuth.type === 'bearer' && effectiveAuth.token) {
                    headers['Authorization'] = `Bearer ${resolveVariables(effectiveAuth.token)}`;
                } else if (effectiveAuth.type === 'basic' && effectiveAuth.username) {
                    headers['Authorization'] = `Basic ${btoa(`${resolveVariables(effectiveAuth.username || '')}:${resolveVariables(effectiveAuth.password || '')}`)}`;
                } else if (effectiveAuth.type === 'apikey' && effectiveAuth.keyValue) {
                    headers[resolveVariables(effectiveAuth.keyName || 'X-API-Key')] = resolveVariables(effectiveAuth.keyValue);
                } else if (effectiveAuth.type === 'auto-auth' && effectiveAuth.autoAuthLoginUrl) {
                    let token = effectiveAuth.autoAuthToken || '';
                    const tokenAge = effectiveAuth.autoAuthTokenTime ? Date.now() - effectiveAuth.autoAuthTokenTime : Infinity;
                    const needsRefresh = !token || tokenAge > 30 * 60 * 1000;
                    if (needsRefresh) {
                        try {
                            let loginBody = null;
                            const bodyStr = effectiveAuth.autoAuthBody || '';
                            if (bodyStr.trim()) {
                                try { loginBody = JSON.parse(bodyStr); } catch { loginBody = bodyStr; }
                            }
                            // Build custom login headers
                            const loginHeaders = { 'Content-Type': 'application/json' };
                            (effectiveAuth.autoAuthLoginHeaders || []).forEach(h => {
                                if (h.key && h.key.trim()) loginHeaders[h.key.trim()] = h.value || '';
                            });
                            const loginRes = await authFetch(`${API_BASE}/proxy`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    url: effectiveAuth.autoAuthLoginUrl,
                                    method: effectiveAuth.autoAuthMethod || 'POST',
                                    headers: loginHeaders,
                                    body: loginBody,
                                })
                            });
                            const loginResult = await loginRes.json();
                            if (loginRes.ok && loginResult.status < 400) {
                                const tokenPath = (effectiveAuth.autoAuthTokenPath || 'token').split('.');
                                let extracted = loginResult.data;
                                for (const key of tokenPath) {
                                    if (extracted && typeof extracted === 'object') extracted = extracted[key];
                                    else { extracted = null; break; }
                                }
                                if (extracted && typeof extracted === 'string') {
                                    token = extracted;
                                    // Cache token: on the collection if inherited, otherwise on the request
                                    const isInherited = !req.authType || req.authType === 'none' || req.authType === 'inherit';
                                    if (isInherited && currentCol) {
                                        const updateCol = useWorkspaceStore.getState().updateCollection;
                                        updateCol(currentCol.id, { autoAuthToken: token, autoAuthTokenTime: Date.now() });
                                    } else {
                                        updateRequest(req.id, { autoAuthToken: token, autoAuthTokenTime: Date.now() });
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Auto-auth login failed:', e);
                        }
                    }
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                }

                let body = null;
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    const bodyContent = req.body?.content;
                    if (bodyContent) {
                        const resolved = resolveVariables(bodyContent);
                        try { body = JSON.parse(resolved); } catch { body = resolved; }
                    }
                }

                let status, responseBody, elapsed, resHeaders = {};

                if (localMode) {
                    // --- Local Mode: direct browser fetch ---
                    const fetchHeaders = { ...headers };
                    if (!fetchHeaders['Content-Type']) fetchHeaders['Content-Type'] = 'application/json';
                    const fetchOpts = { method: req.method || 'GET', headers: fetchHeaders };
                    if (body && req.method !== 'GET' && req.method !== 'HEAD') {
                        fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
                    }
                    try {
                        const directRes = await fetch(resolvedUrl, fetchOpts);
                        elapsed = Date.now() - startTime;
                        status = directRes.status;
                        const ct = directRes.headers.get('content-type') || '';
                        const txt = await directRes.text();
                        responseBody = ct.includes('json') ? (() => { try { return JSON.parse(txt); } catch { return txt; } })() : txt;
                        directRes.headers.forEach((v, k) => { resHeaders[k] = v; });
                    } catch (fetchErr) {
                        elapsed = Date.now() - startTime;
                        status = 0;
                        responseBody = fetchErr.message?.includes('Failed to fetch')
                            ? `CORS Error: ${resolvedUrl} blocked the request. Add CORS headers or disable Local Mode.`
                            : `Request failed: ${fetchErr.message}`;
                    }
                } else {
                    // --- Cloud Proxy Mode ---
                    const proxyRes = await authFetch(`${API_BASE}/proxy`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            url: resolvedUrl,
                            method: req.method || 'GET',
                            headers: { 'Content-Type': 'application/json', ...headers },
                            body
                        })
                    });
                    const data = await proxyRes.json();
                    elapsed = Date.now() - startTime;
                    status = proxyRes.ok ? data.status : proxyRes.status;
                    responseBody = proxyRes.ok ? data.data : (data.detail || data);
                    resHeaders = data.headers || {};
                }

                const success = req.expected_status
                    ? (status === req.expected_status)
                    : (status >= 200 && status < 300);
                const size = responseBody ? new Blob([typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)]).size : 0;

                // --- Run Post-response Script ---
                if (req.postScript?.trim()) {
                    const responseData = {
                        status, statusText: success ? 'OK' : (status ? `${status}` : 'Error'),
                        data: responseBody, headers: resHeaders,
                    };
                    const postResult = runPostResponseScript(req.postScript, {
                        variables: runningVars,
                        environment: getEnvVars(),
                        request: { ...req, url: resolvedUrl, resolvedHeaders: headers },
                        response: responseData,
                        responseTime: elapsed,
                    });
                    if (postResult.updatedVars) {
                        runningVars = { ...runningVars, ...postResult.updatedVars };
                        Object.entries(postResult.updatedVars).forEach(([k, v]) => setChainVar(k, v));
                    }
                    scriptTestResults.push(...(postResult.testResults || []));
                }

                result = {
                    id: req.id, name: req.name, method: req.method, url: req.url,
                    status, statusText: proxyRes.ok ? data.statusText : 'Proxy Error',
                    time: elapsed, size, success,
                    expected_status: req.expected_status, category: req.category,
                    responseBody,
                    scriptTests: scriptTestResults.length > 0 ? scriptTestResults : undefined,
                };
            } catch (err) {
                result = {
                    id: req.id, name: req.name, method: req.method, url: req.url,
                    status: 0, statusText: 'Error', time: Date.now() - startTime,
                    size: 0, success: false, error: err.message,
                    expected_status: req.expected_status, category: req.category,
                    scriptTests: scriptTestResults.length > 0 ? scriptTestResults : undefined,
                };
            }

            results.push(result);
            setRunnerState({ results: [...results], progress: i + 1 });
        }

        finishRun(results, Date.now() - startTotal);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runner, isRunning, setRunnerState, resolveVariables, chainVars, setChainVar, getEnvVars]);

    // Parallel execution via /run endpoint
    const runParallel = useCallback(async () => {
        if (!runner || isRunning) return;
        const requests = runner.requests;
        if (requests.length === 0) return;

        setIsRunning(true);
        setRunnerState({ running: true, progress: 0, results: [], summary: null });
        setOptimizations([]);

        const startTotal = Date.now();

        try {
            // Build tests array for /run endpoint
            const col = collections.find(c => c.id === runner.collectionId);
            const baseUrl = col?.baseUrl || '';
            const tests = requests.map(req => {
                const resolvedUrl = resolveVariables(req.url);
                const headers = {};
                (req.headers || []).forEach(h => {
                    if (h.enabled !== false && h.key) headers[resolveVariables(h.key)] = resolveVariables(h.value);
                });

                // Apply auth headers (same logic as sequential mode)
                // Determine effective auth: per-request auth or inherit from collection
                const effectiveAuth = getEffectiveAuth(req, col);
                if (effectiveAuth.type === 'bearer' && effectiveAuth.token) {
                    headers['Authorization'] = `Bearer ${resolveVariables(effectiveAuth.token)}`;
                } else if (effectiveAuth.type === 'basic' && effectiveAuth.username) {
                    headers['Authorization'] = `Basic ${btoa(`${resolveVariables(effectiveAuth.username || '')}:${resolveVariables(effectiveAuth.password || '')}`)}`;
                } else if (effectiveAuth.type === 'apikey' && effectiveAuth.keyValue) {
                    headers[resolveVariables(effectiveAuth.keyName || 'X-API-Key')] = resolveVariables(effectiveAuth.keyValue);
                }

                let payload = null;
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    const bodyContent = req.body?.content;
                    if (bodyContent) {
                        const resolved = resolveVariables(bodyContent);
                        try { payload = JSON.parse(resolved); } catch { payload = resolved; }
                    }
                }

                return {
                    name: req.name,
                    method: req.method || 'GET',
                    endpoint: resolvedUrl,
                    payload,
                    headers: { 'Content-Type': 'application/json', ...headers },
                    expected_status: req.expected_status || 200,
                };
            });

            const res = await authFetch(`${API_BASE}/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ base_url: baseUrl, tests })
            });

            const data = await res.json();
            const totalTime = Date.now() - startTotal;

            // Map backend results to our format
            const results = (data.results || []).map((r, idx) => ({
                id: requests[idx]?.id || `r-${idx}`,
                name: r.test_name || requests[idx]?.name || `Test ${idx + 1}`,
                method: requests[idx]?.method || 'GET',
                url: requests[idx]?.url || '',
                status: r.status_code || 0,
                statusText: r.status_code >= 200 && r.status_code < 300 ? 'OK' : (r.status_code ? `${r.status_code}` : 'Failed'),
                time: r.duration_ms || 0,
                size: r.size_bytes || 0,
                success: requests[idx]?.expected_status
                    ? (r.status_code === requests[idx].expected_status)
                    : (r.status_code >= 200 && r.status_code < 300),
                expected_status: requests[idx]?.expected_status,
                category: requests[idx]?.category,
                optimization: r.optimization || null,
            }));

            // Collect optimization suggestions
            const opts = results.filter(r => r.optimization && r.optimization.length > 0);
            if (opts.length > 0) {
                setOptimizations(opts.map(r => ({
                    name: r.name,
                    method: r.method,
                    time: r.time,
                    suggestions: r.optimization,
                })));
            }

            setRunnerState({ results, progress: results.length });
            finishRun(results, totalTime);
        } catch (err) {
            // Fallback: if /run fails, show error
            setRunnerState({ running: false });
            setIsRunning(false);
            alert(`Parallel execution failed: ${err.message}. Try sequential mode.`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runner, isRunning, setRunnerState, resolveVariables]);

    const finishRun = (results, totalTime) => {
        const passed = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;
        const times = results.map(r => r.time);
        const avgTime = times.length > 0 ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : 0;
        const maxTime = times.length > 0 ? Math.max(...times) : 0;
        const minTime = times.length > 0 ? Math.min(...times) : 0;
        const slowest = results.find(r => r.time === maxTime);
        const fastest = results.find(r => r.time === minTime);
        const totalSize = results.reduce((a, r) => a + (r.size || 0), 0);

        const summary = {
            totalRequests: results.length, passed, failed, totalTime,
            avgTime, maxTime, minTime, slowest, fastest, totalSize,
            passRate: results.length > 0 ? Math.round((passed / results.length) * 100) : 0,
        };

        setRunnerState({ running: false, summary });
        setIsRunning(false);

        saveRunToCollection({
            collectionName: runner.isTestSuite ? `[Test Suite] ${runner.collectionName}` : runner.collectionName,
            results, summary
        });

        // Save inline summary on the test suite object for display in IntelligencePanel
        if (runner.isTestSuite && runner.suiteId) {
            const updateTestSuiteSummary = useWorkspaceStore.getState().updateTestSuiteSummary;
            updateTestSuiteSummary(runner.collectionId, runner.suiteId, {
                lastRunAt: Date.now(), passed, failed,
                total: results.length, passRate: summary.passRate,
            });
        }
    };

    const runAll = parallel ? runParallel : runSequential;

    if (!runner) return null;

    const { requests, progress, results, summary, collectionName, isHistorical, timestamp, isTestSuite } = runner;
    const progressPct = requests.length > 0 ? Math.round((progress / requests.length) * 100) : 0;

    const formatSize = (bytes) => {
        if (!bytes) return '0B';
        if (bytes < 1024) return `${bytes}B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    };

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 h-full font-sans">
            {/* Header */}
            <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center px-6 gap-4 bg-white dark:bg-slate-900 shadow-sm z-10">
                <BarChart3 size={18} className="text-corporate-600 dark:text-corporate-400" />
                <div className="flex-1">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {isTestSuite ? 'Test Suite Runner' : 'Collection Runner'}
                        {isHistorical && (
                            <span className="text-[10px] font-normal bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                                <History size={9} /> Past Run
                            </span>
                        )}
                    </h2>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                        {collectionName}
                        {isHistorical && timestamp
                            ? ` — ${new Date(timestamp).toLocaleString()}`
                            : ` — ${requests.length} requests`}
                    </p>
                </div>

                {/* Parallel/Sequential Toggle */}
                {!isHistorical && !isRunning && (
                    <button
                        onClick={() => setParallel(!parallel)}
                        className="flex items-center gap-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                        title={parallel ? 'Switch to Sequential (ordered, supports chaining)' : 'Switch to Parallel (fast, via /run endpoint)'}
                    >
                        {parallel ? <ToggleRight size={14} className="text-corporate-600 dark:text-corporate-400" /> : <ToggleLeft size={14} />}
                        {parallel ? 'Parallel' : 'Sequential'}
                    </button>
                )}

                {!isHistorical && (
                    <button
                        onClick={runAll}
                        disabled={isRunning}
                        className="bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 transition-colors"
                    >
                        {isRunning ? (
                            <><Activity size={14} className="animate-spin" /><span>Running...</span></>
                        ) : (
                            <><Play size={14} className="fill-current" /><span>Run All</span></>
                        )}
                    </button>
                )}
                <button
                    onClick={closeRunner}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg text-slate-400 dark:text-slate-500 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Progress Bar */}
            {(isRunning || results.length > 0) && (
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800">
                    <div
                        className={`h-full transition-all duration-300 ${isRunning ? 'bg-corporate-500' : summary?.failed > 0 ? 'bg-amber-500' : 'bg-green-500'}`}
                        style={{ width: `${progressPct}%` }}
                    />
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Summary Cards */}
                {summary && (
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Performance Summary</h3>
                        <div className="grid grid-cols-4 gap-3 mb-4">
                            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3 text-center">
                                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{summary.totalRequests}</div>
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase">Total</div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-lg border border-green-200 dark:border-green-800 p-3 text-center">
                                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{summary.passed}</div>
                                <div className="text-[10px] text-green-500 dark:text-green-400 uppercase">Passed</div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-lg border border-red-200 dark:border-red-800 p-3 text-center">
                                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{summary.failed}</div>
                                <div className="text-[10px] text-red-500 dark:text-red-400 uppercase">Failed</div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-lg border border-corporate-200 dark:border-corporate-800 p-3 text-center">
                                <div className="text-2xl font-bold text-corporate-600 dark:text-corporate-400">{summary.passRate}%</div>
                                <div className="text-[10px] text-corporate-500 dark:text-corporate-400 uppercase">Pass Rate</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 uppercase mb-1">
                                    <Clock size={10} /> Total Time
                                </div>
                                <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{summary.totalTime}ms</div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 uppercase mb-1">
                                    <Zap size={10} /> Avg Time
                                </div>
                                <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{summary.avgTime}ms</div>
                            </div>
                            <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 p-3">
                                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 dark:text-slate-500 uppercase mb-1">
                                    <FileText size={10} /> Total Size
                                </div>
                                <div className="text-lg font-bold text-slate-700 dark:text-slate-300">{formatSize(summary.totalSize)}</div>
                            </div>
                        </div>

                        {/* Slowest / Fastest */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-3">
                                <div className="flex items-center gap-1.5 text-[10px] text-red-400 uppercase mb-1">
                                    <ArrowUp size={10} /> Slowest
                                </div>
                                <div className="text-sm font-bold text-red-700 dark:text-red-400">{summary.maxTime}ms</div>
                                <div className="text-[10px] text-red-500 dark:text-red-400 truncate">{summary.slowest?.name}</div>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 p-3">
                                <div className="flex items-center gap-1.5 text-[10px] text-green-400 uppercase mb-1">
                                    <ArrowDown size={10} /> Fastest
                                </div>
                                <div className="text-sm font-bold text-green-700 dark:text-green-400">{summary.minTime}ms</div>
                                <div className="text-[10px] text-green-500 dark:text-green-400 truncate">{summary.fastest?.name}</div>
                            </div>
                        </div>

                        {/* Response Time Bar Chart */}
                        <div className="mt-4">
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold mb-2">Response Time Distribution</div>
                            <div className="space-y-1">
                                {results.map((r, idx) => {
                                    const widthPct = summary.maxTime > 0 ? Math.max(4, (r.time / summary.maxTime) * 100) : 100;
                                    return (
                                        <div key={idx} className="flex items-center gap-2 text-[10px]">
                                            <span className={`w-10 shrink-0 font-bold px-1 py-0.5 rounded text-center ${METHOD_COLORS[r.method] || 'text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-800'}`}>
                                                {r.method}
                                            </span>
                                            <span className="w-24 shrink-0 truncate text-slate-500 dark:text-slate-400">{r.name}</span>
                                            <div className="flex-1 bg-slate-100 dark:bg-slate-800 rounded-full h-3 overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${r.success ? 'bg-green-400' : 'bg-red-400'}`}
                                                    style={{ width: `${widthPct}%` }}
                                                />
                                            </div>
                                            <span className="w-14 text-right font-mono text-slate-600 dark:text-slate-400">{r.time}ms</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                )}

                {/* AI Optimization Insights */}
                {optimizations.length > 0 && (
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-corporate-50/30 dark:bg-corporate-900/20">
                        <h3 className="text-xs font-bold text-corporate-700 dark:text-corporate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Sparkles size={12} className="text-corporate-600 dark:text-corporate-400" />
                            AI Optimization Insights
                        </h3>
                        {optimizations.map((opt, idx) => (
                            <div key={idx} className="mb-3 bg-white dark:bg-slate-900 border border-corporate-200 dark:border-corporate-800 rounded-lg p-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${METHOD_COLORS[opt.method] || 'text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-800'}`}>
                                        {opt.method}
                                    </span>
                                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{opt.name}</span>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 ml-auto font-mono">{opt.time}ms</span>
                                </div>
                                {opt.suggestions.map((s, sIdx) => (
                                    <div key={sIdx} className="flex items-start gap-2 mt-1.5 pl-2">
                                        <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded border shrink-0 mt-0.5 ${IMPACT_COLORS[s.impact] || IMPACT_COLORS.Medium}`}>
                                            {s.impact || 'Medium'}
                                        </span>
                                        <div>
                                            <div className="text-[10px] font-semibold text-slate-600 dark:text-slate-400">{s.issue}</div>
                                            <div className="text-[10px] text-slate-500 dark:text-slate-400">{s.suggestion}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ))}
                    </div>
                )}

                {/* Results Table */}
                <div className="p-6">
                    <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                        {results.length > 0 ? 'Results' : 'Requests'} ({results.length || requests.length})
                    </h3>
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-[10px] text-slate-400 dark:text-slate-500 uppercase border-b border-slate-200 dark:border-slate-700">
                                <th className="text-left pb-2 pl-2 w-8">#</th>
                                <th className="text-left pb-2 w-12">Method</th>
                                <th className="text-left pb-2">Name</th>
                                <th className="text-center pb-2 w-16">Status</th>
                                <th className="text-right pb-2 w-16">Time</th>
                                <th className="text-right pb-2 pr-2 w-14">Size</th>
                                <th className="text-center pb-2 w-16"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {(results.length > 0 ? results : requests).map((item, idx) => {
                                const isResult = results.length > 0;
                                const isCurrent = isRunning && idx === progress;
                                const isExpanded = expandedRow === idx;
                                return (
                                    <React.Fragment key={idx}>
                                    <tr
                                        className={`border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 ${isCurrent ? 'bg-corporate-50 dark:bg-corporate-900/20' : ''} ${isExpanded ? 'bg-slate-50 dark:bg-slate-800/50' : ''} ${isResult ? 'animate-fade-in' : ''}`}
                                        style={isResult ? { animationDelay: `${idx * 50}ms`, animationFillMode: 'both' } : undefined}
                                        onClick={() => setExpandedRow(isExpanded ? null : idx)}
                                    >
                                        <td className="py-2 pl-2 text-slate-400 dark:text-slate-500">{idx + 1}</td>
                                        <td className="py-2">
                                            <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${METHOD_COLORS[item.method] || 'text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-800'}`}>
                                                {item.method}
                                            </span>
                                        </td>
                                        <td className="py-2 text-slate-700 dark:text-slate-300 truncate max-w-[200px]">
                                            {item.name}
                                            {item.category && (
                                                <span className="ml-1 text-[8px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">
                                                    {item.category.replace('_', ' ')}
                                                </span>
                                            )}
                                            {item.scriptTests?.length > 0 && (
                                                <span className={`ml-1 text-[8px] font-bold px-1 py-0.5 rounded ${
                                                    item.scriptTests.every(t => t.passed) ? 'text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20' : 'text-red-700 bg-red-50 dark:text-red-400 dark:bg-red-900/20'
                                                }`}>
                                                    {item.scriptTests.filter(t => t.passed).length}/{item.scriptTests.length} tests
                                                </span>
                                            )}
                                            {isCurrent && <Activity size={10} className="inline ml-2 animate-spin text-corporate-500" />}
                                        </td>
                                        <td className="py-2 text-center">
                                            {isResult ? (
                                                <span className={`inline-flex items-center gap-1 text-[10px] font-bold ${item.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                    {item.success ? <CheckCircle size={10} /> : <XCircle size={10} />}
                                                    {item.status}
                                                </span>
                                            ) : (
                                                <span className="text-slate-300 dark:text-slate-600">—</span>
                                            )}
                                        </td>
                                        <td className="py-2 text-right font-mono text-slate-500 dark:text-slate-400">
                                            {isResult ? `${item.time}ms` : '—'}
                                        </td>
                                        <td className="py-2 text-right pr-2 font-mono text-slate-400 dark:text-slate-500">
                                            {isResult ? formatSize(item.size) : '—'}
                                        </td>
                                        <td className="py-2 text-center w-16" onClick={e => e.stopPropagation()}>
                                            {isResult && !item.success && (
                                                <button
                                                    onClick={() => handleDiagnose(item)}
                                                    disabled={diagnosing[item.id]}
                                                    className="text-[9px] font-bold text-corporate-600 dark:text-corporate-400 hover:text-corporate-700 dark:hover:text-corporate-300 flex items-center gap-0.5 mx-auto disabled:text-slate-400"
                                                    title="Diagnose failure with AI"
                                                >
                                                    {diagnosing[item.id] ? <Activity size={10} className="animate-spin" /> : <Stethoscope size={10} />}
                                                    <span>{diagnosing[item.id] ? '...' : 'Diagnose'}</span>
                                                </button>
                                            )}
                                        </td>
                                    </tr>

                                    {/* Expanded Detail Panel — shows URL, request body, response body */}
                                    {isExpanded && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-3 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-700">
                                                <div className="space-y-3">
                                                    {/* URL */}
                                                    {item.url && (
                                                        <div>
                                                            <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">URL</div>
                                                            <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 rounded px-3 py-1.5 border border-slate-200 dark:border-slate-700 break-all">
                                                                {item.url}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Request Body (from the original request) */}
                                                    {(() => {
                                                        const req = requests[idx];
                                                        const bodyContent = req?.body?.content || req?.payload;
                                                        if (!bodyContent) return null;
                                                        let formatted;
                                                        try {
                                                            formatted = JSON.stringify(typeof bodyContent === 'string' ? JSON.parse(bodyContent) : bodyContent, null, 2);
                                                        } catch { formatted = typeof bodyContent === 'string' ? bodyContent : JSON.stringify(bodyContent); }
                                                        return (
                                                            <div>
                                                                <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Request Body</div>
                                                                <pre className="text-[10px] font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 rounded px-3 py-2 border border-slate-200 dark:border-slate-700 max-h-32 overflow-auto whitespace-pre-wrap">
                                                                    {formatted}
                                                                </pre>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Request Headers (from the original request) */}
                                                    {(() => {
                                                        const req = requests[idx];
                                                        const headers = (req?.headers || []).filter(h => h.enabled !== false && h.key);
                                                        if (headers.length === 0) return null;
                                                        return (
                                                            <div>
                                                                <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Request Headers</div>
                                                                <div className="text-[10px] font-mono bg-white dark:bg-slate-900 rounded px-3 py-2 border border-slate-200 dark:border-slate-700">
                                                                    {headers.map((h, i) => (
                                                                        <div key={i} className="text-slate-700 dark:text-slate-300">
                                                                            <span className="text-slate-500 dark:text-slate-400">{h.key}:</span> {h.value}
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}

                                                    {/* Response Status + Body */}
                                                    {isResult && (
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Response Body</span>
                                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${item.success ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                                                    {item.status} {item.statusText}
                                                                </span>
                                                                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">{item.time}ms</span>
                                                            </div>
                                                            {item.responseBody ? (
                                                                <pre className="text-[10px] font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 rounded px-3 py-2 border border-slate-200 dark:border-slate-700 max-h-48 overflow-auto whitespace-pre-wrap">
                                                                    {typeof item.responseBody === 'string' ? item.responseBody : JSON.stringify(item.responseBody, null, 2)}
                                                                </pre>
                                                            ) : item.error ? (
                                                                <div className="text-[10px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded px-3 py-2 border border-red-200 dark:border-red-800">
                                                                    {item.error}
                                                                </div>
                                                            ) : (
                                                                <div className="text-[10px] text-slate-400 dark:text-slate-500 italic">No response body</div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}

                                    {/* AI Diagnosis Card */}
                                    {diagnoses[item.id] && (
                                        <tr className="animate-slide-up">
                                            <td colSpan={7} className="px-4 py-3">
                                                <div className="bg-corporate-50/50 dark:bg-corporate-900/20 border border-corporate-200 dark:border-corporate-800 rounded-lg p-4">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <Sparkles size={14} className="text-corporate-600 dark:text-corporate-400" />
                                                        <span className="text-xs font-bold text-corporate-700 dark:text-corporate-300">AI Diagnosis</span>
                                                        {diagnoses[item.id].confidence && (
                                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                                                                diagnoses[item.id].confidence === 'high' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                                diagnoses[item.id].confidence === 'medium' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                                                'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                                                            }`}>
                                                                {diagnoses[item.id].confidence} confidence
                                                            </span>
                                                        )}
                                                    </div>
                                                    {diagnoses[item.id].error ? (
                                                        <p className="text-xs text-red-600 dark:text-red-400">{diagnoses[item.id].error}</p>
                                                    ) : (
                                                        <>
                                                            <div className="flex items-start gap-2 mb-2">
                                                                <AlertTriangle size={12} className="text-red-500 mt-0.5 shrink-0" />
                                                                <div>
                                                                    <div className="text-xs font-semibold text-red-700 dark:text-red-400">{diagnoses[item.id].root_cause}</div>
                                                                    <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">{diagnoses[item.id].explanation}</p>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-start gap-2 mt-3 pt-2 border-t border-corporate-200 dark:border-corporate-700">
                                                                <Lightbulb size={12} className="text-amber-500 mt-0.5 shrink-0" />
                                                                <div>
                                                                    <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase mb-0.5">Suggested Fix</div>
                                                                    <p className="text-[11px] text-slate-700 dark:text-slate-300">{diagnoses[item.id].suggested_fix}</p>
                                                                </div>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                {/* Empty state */}
                {results.length === 0 && !isRunning && !isHistorical && (
                    <div className="px-6 pb-6">
                        <div className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-6 text-center">
                            <Play size={24} className="mx-auto mb-2 text-slate-300 dark:text-slate-600" />
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                                Click <strong>Run All</strong> to execute all {requests.length} requests
                                {parallel ? ' in parallel' : ' sequentially'}.
                            </p>
                            {parallel && (
                                <p className="text-[10px] text-corporate-500 dark:text-corporate-400 mt-1">
                                    Parallel mode uses the /run endpoint for AI optimization analysis.
                                </p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
