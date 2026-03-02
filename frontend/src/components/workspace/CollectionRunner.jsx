import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Play, X, Activity, CheckCircle, XCircle, Clock, Zap, BarChart3, ArrowDown, ArrowUp, FileText, History, Sparkles, ToggleLeft, ToggleRight, Stethoscope, Lightbulb, AlertTriangle, Upload, Database, Square, Download } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { runPreRequestScript, runPostResponseScript } from '../../utils/scriptEngine';
import { toast } from '../../utils/toast';

import { API_BASE, authFetch } from '../../config';
import { proxyFetch } from '../../utils/proxyFetch';
import { generateJunitXml, generateHtmlReport, downloadFile } from '../../utils/exportResults';

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

// --- CSV/JSON data file parser ---
function parseCSV(text) {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length < 2) return null;
    // Parse header
    const parseRow = (line) => {
        const cells = [];
        let current = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"' && (i === 0 || line[i - 1] !== '\\')) { inQuotes = !inQuotes; continue; }
            if (ch === ',' && !inQuotes) { cells.push(current.trim()); current = ''; continue; }
            current += ch;
        }
        cells.push(current.trim());
        return cells;
    };
    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map(line => {
        const cells = parseRow(line);
        const obj = {};
        headers.forEach((h, i) => { obj[h] = cells[i] || ''; });
        return obj;
    });
    return { headers, rows };
}

function parseDataFile(text, filename) {
    if (filename?.endsWith('.json')) {
        try {
            const data = JSON.parse(text);
            if (Array.isArray(data) && data.length > 0) {
                return { headers: Object.keys(data[0]), rows: data };
            }
        } catch { /* fall through to CSV */ }
    }
    return parseCSV(text);
}

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
    const [dataFile, setDataFile] = useState(null);
    const [activeIteration, setActiveIteration] = useState(0);
    const [iterationResults, setIterationResults] = useState([]);
    const dataFileRef = useRef(null);
    const abortRef = useRef(null);

    // Cleanup: abort any in-flight run on unmount
    useEffect(() => {
        return () => {
            if (abortRef.current) abortRef.current.abort();
        };
    }, []);

    const cancelRun = useCallback(() => {
        if (abortRef.current) abortRef.current.abort();
        abortRef.current = null;
        setIsRunning(false);
        setRunnerState({ running: false });
    }, [setRunnerState]);

    const handleDiagnose = async (result) => {
        if (diagnosing[result.id]) return;
        setDiagnosing(prev => ({ ...prev, [result.id]: true }));
        try {
            // Get collection's OpenAPI spec for richer diagnosis context
            const col = collections.find(c => c.id === runner?.collectionId);
            const responseBodyStr = result.responseBody
                ? (typeof result.responseBody === 'string' ? result.responseBody : JSON.stringify(result.responseBody))
                : (result.error || '');

            const res = await authFetch(`${API_BASE}/diagnose`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: result.method,
                    url: result.url,
                    expected_status: result.expected_status || 200,
                    actual_status: result.status,
                    response_body: responseBodyStr,
                    response_headers: result.responseHeaders || null,
                    openapi_spec: col?.openApiSpec || null,
                })
            });
            const data = await res.json();
            // Validate diagnosis has content — if all fields empty, show a fallback
            if (data && !data.error && !data.root_cause && !data.explanation && !data.suggested_fix) {
                data.root_cause = `HTTP ${result.status} returned`;
                data.explanation = result.status === 404
                    ? 'The requested resource was not found. The endpoint path or resource ID may be incorrect.'
                    : `The server returned status ${result.status} instead of the expected ${result.expected_status || 200}.`;
                data.suggested_fix = 'Verify the endpoint URL, resource ID, and request parameters are correct.';
                data.confidence = 'low';
            }
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
     * Priority: 1) "No Auth" = no auth period  2) Own auth = use request's config
     *           3) "Inherit"/unset = use collection auth  4) Nothing = no auth
     */
    const getEffectiveAuth = (req, col) => {
        // 0. Force collection auth: override ALL request auth
        if (col?.forceCollectionAuth && col.authType && col.authType !== 'none') {
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

        // 1. "No Auth" explicitly selected — NO inheritance, return immediately
        if (req.authType === 'none') {
            return { type: 'none' };
        }

        // 2. Request has its own auth configured (bearer/basic/apikey/auto-auth)
        const hasOwnAuth = req.authType && req.authType !== 'inherit';
        if (hasOwnAuth) {
            return {
                type: req.authType,
                token: req.authToken,
                username: req.authUsername,
                password: req.authPassword,
                keyName: req.authKeyName,
                keyValue: req.authKeyValue,
                autoAuthLoginUrl: req.autoAuthLoginUrl,
                autoAuthMethod: req.autoAuthMethod,
                autoAuthBody: req.autoAuthBody,
                autoAuthTokenPath: req.autoAuthTokenPath,
                autoAuthLoginHeaders: req.autoAuthLoginHeaders,
                autoAuthToken: req.autoAuthToken,
                autoAuthTokenTime: req.autoAuthTokenTime,
            };
        }

        // 3. Inherit from collection (authType is 'inherit' or undefined/empty)
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

        // 4. No auth anywhere
        return { type: 'none' };
    };

    // Sequential execution via /proxy (supports request chaining + scripts)
    const runSequential = useCallback(async () => {
        if (!runner || isRunning) return;
        const requests = runner.requests;
        if (requests.length === 0) return;

        const controller = new AbortController();
        abortRef.current = controller;

        setIsRunning(true);
        setRunnerState({ running: true, progress: 0, results: [], summary: null });
        setOptimizations([]);
        setIterationResults([]);
        setActiveIteration(0);

        const iterations = dataFile?.rows || [null];
        const allIterResults = [];
        const startTotal = Date.now();

        for (let iter = 0; iter < iterations.length; iter++) {
        if (controller.signal.aborted) break;
        const iterRow = iterations[iter];
        // Set data row values as chain vars for this iteration
        if (iterRow) {
            Object.entries(iterRow).forEach(([k, v]) => setChainVar(k, v));
        }

        const results = [];
        // Local copy of chain vars for script chaining across requests
        let runningVars = iterRow ? { ...chainVars, ...iterRow } : { ...chainVars };

        for (let i = 0; i < requests.length; i++) {
            if (controller.signal.aborted) break;
            const req = requests[i];
            setRunnerState({ progress: i });

            const startTime = Date.now();
            let result;
            let scriptTestResults = [];

            try {
                // --- Run Collection Pre-request Script ---
                const currentColForScripts = useWorkspaceStore.getState().collections.find(c => c.id === runner.collectionId);
                if (currentColForScripts?.preScript?.trim()) {
                    const colPreResult = await runPreRequestScript(currentColForScripts.preScript, {
                        variables: runningVars,
                        environment: getEnvVars(),
                        request: req,
                    });
                    if (colPreResult.updatedVars) {
                        runningVars = { ...runningVars, ...colPreResult.updatedVars };
                        Object.entries(colPreResult.updatedVars).forEach(([k, v]) => setChainVar(k, v));
                    }
                    scriptTestResults.push(...(colPreResult.testResults || []));
                }

                // --- Run Request Pre-request Script ---
                if (req.preScript?.trim()) {
                    const preResult = await runPreRequestScript(req.preScript, {
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
                // Use fresh store state so cached auto-auth tokens are visible across iterations
                const currentCol = useWorkspaceStore.getState().collections.find(c => c.id === runner.collectionId);
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
                            const loginResult = await proxyFetch({
                                url: effectiveAuth.autoAuthLoginUrl,
                                method: effectiveAuth.autoAuthMethod || 'POST',
                                headers: loginHeaders,
                                body: loginBody,
                                localMode,
                            });
                            if (loginResult.status >= 200 && loginResult.status < 400) {
                                const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
                                const tokenPath = (effectiveAuth.autoAuthTokenPath || 'token').split('.');
                                let extracted = loginResult.data;
                                for (const key of tokenPath) {
                                    if (BLOCKED_KEYS.has(key)) { extracted = null; break; }
                                    if (extracted && typeof extracted === 'object') extracted = extracted[key];
                                    else { extracted = null; break; }
                                }
                                if (extracted && typeof extracted === 'string') {
                                    token = extracted;
                                    // Cache token: on the collection if forced/inherited, otherwise on the request
                                    const isFromCollection = currentCol?.forceCollectionAuth || !req.authType || req.authType === 'inherit';
                                    if (isFromCollection && currentCol) {
                                        const updateCol = useWorkspaceStore.getState().updateCollection;
                                        updateCol(currentCol.id, { autoAuthToken: token, autoAuthTokenTime: Date.now() });
                                    } else {
                                        updateRequest(req.id, { autoAuthToken: token, autoAuthTokenTime: Date.now() });
                                    }
                                }
                            }
                        } catch (e) {
                            console.warn('Auto-auth login failed:', e);
                            scriptTestResults.push({
                                name: 'Auto-Auth Login',
                                passed: false,
                                error: `Login failed: ${e.message}`,
                            });
                        }
                    }
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                }

                let body = null;
                let bodyContentType = null;
                const bodyType = req.body?.type || 'json';
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    const bodyContent = req.body?.content;
                    if (bodyContent) {
                        if (bodyType === 'json') {
                            const resolved = resolveVariables(bodyContent);
                            try { body = JSON.parse(resolved); } catch { body = resolved; }
                        } else if (bodyType === 'form' || bodyType === 'urlencoded') {
                            let pairs = [];
                            try { pairs = JSON.parse(bodyContent); } catch { pairs = []; }
                            body = pairs.filter(p => p.enabled !== false && p.key)
                                .map(p => ({ key: resolveVariables(p.key), value: resolveVariables(p.value || '') }));
                            bodyContentType = bodyType;
                        } else if (bodyType === 'raw') {
                            body = resolveVariables(bodyContent);
                            bodyContentType = 'raw';
                        }
                    }
                }

                let status, responseBody, elapsed, resHeaders = {}, statusText = '';

                if (localMode) {
                    // --- Local Mode: direct browser fetch ---
                    const fetchHeaders = { ...headers };
                    const fetchOpts = { method: req.method || 'GET', headers: fetchHeaders, signal: controller.signal };
                    if (body != null && req.method !== 'GET' && req.method !== 'HEAD') {
                        if (bodyContentType === 'form' && Array.isArray(body)) {
                            const fd = new FormData();
                            body.forEach(p => fd.append(p.key, p.value));
                            fetchOpts.body = fd;
                            delete fetchOpts.headers['Content-Type'];
                        } else if (bodyContentType === 'urlencoded' && Array.isArray(body)) {
                            fetchOpts.body = body.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
                            fetchOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                        } else if (bodyContentType === 'raw') {
                            fetchOpts.body = body;
                            if (!fetchOpts.headers['Content-Type']) fetchOpts.headers['Content-Type'] = 'text/plain';
                        } else {
                            fetchOpts.body = typeof body === 'string' ? body : JSON.stringify(body);
                            if (!fetchOpts.headers['Content-Type']) fetchOpts.headers['Content-Type'] = 'application/json';
                        }
                    } else if (!fetchOpts.headers['Content-Type']) {
                        fetchOpts.headers['Content-Type'] = 'application/json';
                    }
                    try {
                        const directRes = await fetch(resolvedUrl, fetchOpts);
                        elapsed = Date.now() - startTime;
                        status = directRes.status;
                        statusText = directRes.statusText || (status >= 200 && status < 300 ? 'OK' : `${status}`);
                        const ct = directRes.headers.get('content-type') || '';
                        const txt = await directRes.text();
                        responseBody = ct.includes('json') ? (() => { try { return JSON.parse(txt); } catch { return txt; } })() : txt;
                        directRes.headers.forEach((v, k) => { resHeaders[k] = v; });
                    } catch (fetchErr) {
                        elapsed = Date.now() - startTime;
                        status = 0;
                        statusText = 'Network Error';
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
                            headers,
                            body,
                            body_type: bodyType
                        }),
                        signal: controller.signal,
                    });
                    const data = await proxyRes.json();
                    elapsed = Date.now() - startTime;
                    status = proxyRes.ok ? data.status : proxyRes.status;
                    statusText = proxyRes.ok ? (data.statusText || 'OK') : 'Proxy Error';
                    responseBody = proxyRes.ok ? data.data : (data.detail || data);
                    resHeaders = data.headers || {};
                }

                const success = req.expected_status
                    ? (status === req.expected_status)
                    : (status >= 200 && status < 300);
                const size = responseBody ? new Blob([typeof responseBody === 'string' ? responseBody : JSON.stringify(responseBody)]).size : 0;

                // --- Run Request Post-response Script ---
                const responseData = {
                    status, statusText: success ? 'OK' : (status ? `${status}` : 'Error'),
                    data: responseBody, headers: resHeaders,
                };
                if (req.postScript?.trim()) {
                    const postResult = await runPostResponseScript(req.postScript, {
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

                // --- Run Collection Post-response Script ---
                if (currentColForScripts?.postScript?.trim()) {
                    const colPostResult = await runPostResponseScript(currentColForScripts.postScript, {
                        variables: runningVars,
                        environment: getEnvVars(),
                        request: { ...req, url: resolvedUrl, resolvedHeaders: headers },
                        response: responseData,
                        responseTime: elapsed,
                    });
                    if (colPostResult.updatedVars) {
                        runningVars = { ...runningVars, ...colPostResult.updatedVars };
                        Object.entries(colPostResult.updatedVars).forEach(([k, v]) => setChainVar(k, v));
                    }
                    scriptTestResults.push(...(colPostResult.testResults || []));
                }

                result = {
                    id: req.id, name: req.name, method: req.method, url: req.url,
                    status, statusText,
                    time: elapsed, size, success,
                    expected_status: req.expected_status, category: req.category,
                    responseBody, responseHeaders: resHeaders,
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

        allIterResults.push(results);
        } // end iteration loop

        // If cancelled mid-run, finalize with partial results
        if (controller.signal.aborted) {
            const partialResults = allIterResults.length > 0 ? allIterResults[allIterResults.length - 1] : [];
            setIterationResults(allIterResults);
            setRunnerState({ results: partialResults, progress: partialResults.length, running: false });
            setIsRunning(false);
            if (partialResults.length > 0) finishRun(partialResults, Date.now() - startTotal);
            return;
        }

        // Show last iteration results in runner state; store all iterations
        setIterationResults(allIterResults);
        setActiveIteration(allIterResults.length - 1);
        const finalResults = allIterResults.length > 0 ? allIterResults[allIterResults.length - 1] : [];
        setRunnerState({ results: finalResults, progress: requests.length });
        finishRun(finalResults, Date.now() - startTotal);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runner, isRunning, setRunnerState, resolveVariables, chainVars, setChainVar, getEnvVars, dataFile]);

    // Parallel execution via /run endpoint
    const runParallel = useCallback(async () => {
        if (!runner || isRunning) return;
        const requests = runner.requests;
        if (requests.length === 0) return;

        const controller = new AbortController();
        abortRef.current = controller;

        setIsRunning(true);
        setRunnerState({ running: true, progress: 0, results: [], summary: null });
        setOptimizations([]);

        const startTotal = Date.now();

        try {
            // Build tests array for /run endpoint
            // Use fresh store state to avoid stale closure
            const col = useWorkspaceStore.getState().collections.find(c => c.id === runner.collectionId);
            const baseUrl = col?.baseUrl || '';

            // --- Pre-flight: auto-auth token acquisition (ONE login for the entire batch) ---
            let batchAutoAuthToken = null;
            if (col?.authType === 'auto-auth' && col.autoAuthLoginUrl) {
                const cached = col.autoAuthToken;
                const age = col.autoAuthTokenTime ? Date.now() - col.autoAuthTokenTime : Infinity;
                if (cached && age < 30 * 60 * 1000) {
                    batchAutoAuthToken = cached;
                } else {
                    try {
                        let loginBody = null;
                        const bodyStr = col.autoAuthBody || '';
                        if (bodyStr.trim()) {
                            try { loginBody = JSON.parse(bodyStr); } catch { loginBody = bodyStr; }
                        }
                        const loginHeaders = { 'Content-Type': 'application/json' };
                        (col.autoAuthLoginHeaders || []).forEach(h => {
                            if (h.key?.trim()) loginHeaders[h.key.trim()] = h.value || '';
                        });
                        const loginResult = await proxyFetch({
                            url: col.autoAuthLoginUrl,
                            method: col.autoAuthMethod || 'POST',
                            headers: loginHeaders,
                            body: loginBody,
                            localMode,
                        });
                        if (loginResult.status >= 200 && loginResult.status < 400) {
                            const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
                            const tokenPath = (col.autoAuthTokenPath || 'token').split('.');
                            let extracted = loginResult.data;
                            for (const key of tokenPath) {
                                if (BLOCKED_KEYS.has(key)) { extracted = null; break; }
                                if (extracted && typeof extracted === 'object') extracted = extracted[key];
                                else { extracted = null; break; }
                            }
                            if (extracted && typeof extracted === 'string') {
                                batchAutoAuthToken = extracted;
                                useWorkspaceStore.getState().updateCollection(col.id, {
                                    autoAuthToken: extracted, autoAuthTokenTime: Date.now()
                                });
                            }
                        }
                    } catch (e) {
                        console.warn('Auto-auth login failed for parallel batch:', e);
                    }
                }
            }

            const tests = requests.map(req => {
                const resolvedUrl = resolveVariables(req.url);
                const headers = {};
                (req.headers || []).forEach(h => {
                    if (h.enabled !== false && h.key) headers[resolveVariables(h.key)] = resolveVariables(h.value);
                });

                // Apply auth headers — respects per-request auth priority
                const effectiveAuth = getEffectiveAuth(req, col);
                if (effectiveAuth.type === 'bearer' && effectiveAuth.token) {
                    headers['Authorization'] = `Bearer ${resolveVariables(effectiveAuth.token)}`;
                } else if (effectiveAuth.type === 'basic' && effectiveAuth.username) {
                    headers['Authorization'] = `Basic ${btoa(`${resolveVariables(effectiveAuth.username || '')}:${resolveVariables(effectiveAuth.password || '')}`)}`;
                } else if (effectiveAuth.type === 'apikey' && effectiveAuth.keyValue) {
                    headers[resolveVariables(effectiveAuth.keyName || 'X-API-Key')] = resolveVariables(effectiveAuth.keyValue);
                } else if (effectiveAuth.type === 'auto-auth') {
                    // Use pre-flight batch token (collection-level) or request's own cached token
                    const token = batchAutoAuthToken || effectiveAuth.autoAuthToken || '';
                    if (token) headers['Authorization'] = `Bearer ${token}`;
                }

                let payload = null;
                let payloadType = null;
                const bType = req.body?.type || 'json';
                if (req.method !== 'GET' && req.method !== 'HEAD') {
                    const bodyContent = req.body?.content;
                    if (bodyContent) {
                        if (bType === 'json') {
                            const resolved = resolveVariables(bodyContent);
                            try { payload = JSON.parse(resolved); } catch { payload = resolved; }
                        } else if (bType === 'form' || bType === 'urlencoded') {
                            let pairs = [];
                            try { pairs = JSON.parse(bodyContent); } catch { pairs = []; }
                            payload = pairs.filter(p => p.enabled !== false && p.key)
                                .map(p => ({ key: resolveVariables(p.key), value: resolveVariables(p.value || '') }));
                            payloadType = bType;
                        } else if (bType === 'raw') {
                            payload = resolveVariables(bodyContent);
                            payloadType = 'raw';
                        }
                    }
                }

                return {
                    name: req.name,
                    method: req.method || 'GET',
                    url: resolvedUrl,
                    endpoint: resolvedUrl,
                    payload,
                    payloadType,
                    headers,
                    expected_status: req.expected_status || 200,
                    body_type: bType,
                };
            });

            let results;

            if (localMode) {
                // --- Local Mode: parallel fetch directly from browser ---
                const fetches = tests.map(async (t, idx) => {
                    const start = Date.now();
                    try {
                        const fetchOpts = { method: t.method, headers: { ...t.headers }, signal: controller.signal };
                        if (t.payload != null && t.method !== 'GET' && t.method !== 'HEAD') {
                            if (t.payloadType === 'form' && Array.isArray(t.payload)) {
                                const fd = new FormData();
                                t.payload.forEach(p => fd.append(p.key, p.value));
                                fetchOpts.body = fd;
                                delete fetchOpts.headers['Content-Type'];
                            } else if (t.payloadType === 'urlencoded' && Array.isArray(t.payload)) {
                                fetchOpts.body = t.payload.map(p => `${encodeURIComponent(p.key)}=${encodeURIComponent(p.value)}`).join('&');
                                fetchOpts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
                            } else if (t.payloadType === 'raw') {
                                fetchOpts.body = t.payload;
                                if (!fetchOpts.headers['Content-Type']) fetchOpts.headers['Content-Type'] = 'text/plain';
                            } else {
                                fetchOpts.body = typeof t.payload === 'string' ? t.payload : JSON.stringify(t.payload);
                                if (!fetchOpts.headers['Content-Type']) fetchOpts.headers['Content-Type'] = 'application/json';
                            }
                        } else if (!fetchOpts.headers['Content-Type']) {
                            fetchOpts.headers['Content-Type'] = 'application/json';
                        }
                        const r = await fetch(t.url, fetchOpts);
                        const elapsed = Date.now() - start;
                        const ct = r.headers.get('content-type') || '';
                        const txt = await r.text();
                        const size = new Blob([txt]).size;
                        let responseBody = ct.includes('json') ? (() => { try { return JSON.parse(txt); } catch { return txt; } })() : txt;
                        return {
                            id: requests[idx]?.id || `r-${idx}`,
                            name: t.name, method: t.method, url: t.url,
                            status: r.status, statusText: r.statusText || 'OK',
                            time: elapsed, size,
                            success: requests[idx]?.expected_status
                                ? (r.status === requests[idx].expected_status)
                                : (r.status >= 200 && r.status < 300),
                            expected_status: requests[idx]?.expected_status,
                            category: requests[idx]?.category,
                            responseBody,
                        };
                    } catch (err) {
                        return {
                            id: requests[idx]?.id || `r-${idx}`,
                            name: t.name, method: t.method, url: t.url,
                            status: 0, statusText: 'Network Error',
                            time: Date.now() - start, size: 0, success: false,
                            expected_status: requests[idx]?.expected_status,
                            category: requests[idx]?.category,
                            error: err.message,
                        };
                    }
                });
                results = await Promise.all(fetches);
            } else {
                // --- Cloud Proxy Mode: send batch to /run endpoint ---
                const res = await authFetch(`${API_BASE}/run`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base_url: baseUrl, tests }),
                    signal: controller.signal,
                });

                const data = await res.json();

                results = (data.results || []).map((r, idx) => {
                    // Parse response body (backend sends as string)
                    let responseBody = r.response_body || null;
                    if (responseBody && typeof responseBody === 'string') {
                        try { responseBody = JSON.parse(responseBody); } catch { /* keep as string */ }
                    }
                    return {
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
                        responseBody,
                        error: r.error || null,
                        optimization: r.optimization || null,
                    };
                });

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
            }

            const totalTime = Date.now() - startTotal;
            setRunnerState({ results, progress: results.length });
            finishRun(results, totalTime);
        } catch (err) {
            if (err.name === 'AbortError') {
                // User cancelled — keep partial state, don't show error
                setRunnerState({ running: false });
                setIsRunning(false);
                return;
            }
            // Fallback: if /run fails, show error
            setRunnerState({ running: false });
            setIsRunning(false);
            toast.error(`Parallel execution failed: ${err.message}. Try sequential mode.`);
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

                {/* Data File Upload */}
                {!isHistorical && !isRunning && (
                    <div className="flex items-center gap-1.5">
                        <input ref={dataFileRef} type="file" accept=".csv,.json" className="hidden" onChange={(e) => {
                            const file = e.target.files[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                                const parsed = parseDataFile(ev.target.result, file.name);
                                if (parsed && parsed.rows.length > 0) {
                                    setDataFile({ name: file.name, ...parsed });
                                }
                            };
                            reader.readAsText(file);
                            e.target.value = '';
                        }} />
                        {dataFile ? (
                            <div className="flex items-center gap-1 text-[10px] font-medium text-corporate-600 dark:text-corporate-400 px-2 py-1 rounded border border-corporate-200 dark:border-corporate-700 bg-corporate-50 dark:bg-corporate-900/20">
                                <Database size={10} />
                                <span>{dataFile.name} ({dataFile.rows.length} rows)</span>
                                <button onClick={() => setDataFile(null)} className="ml-1 text-slate-400 hover:text-red-500">&times;</button>
                            </div>
                        ) : (
                            <button
                                onClick={() => dataFileRef.current?.click()}
                                className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 transition-colors px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
                                title="Upload CSV/JSON data file for data-driven testing"
                            >
                                <Upload size={10} /> Data File
                            </button>
                        )}
                    </div>
                )}

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
                    isRunning ? (
                        <button
                            onClick={cancelRun}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 transition-colors"
                        >
                            <Square size={14} className="fill-current" />
                            <span>Cancel</span>
                        </button>
                    ) : (
                        <button
                            onClick={runAll}
                            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-semibold text-xs flex items-center gap-2 transition-colors"
                        >
                            <Play size={14} className="fill-current" />
                            <span>Run All</span>
                        </button>
                    )
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

            {/* Iteration Tabs (data-driven) */}
            {iterationResults.length > 1 && (
                <div className="flex items-center gap-1 px-6 py-1.5 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-x-auto">
                    <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mr-1">Iteration:</span>
                    {iterationResults.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                setActiveIteration(idx);
                                setRunnerState({ results: iterationResults[idx], progress: runner.requests.length });
                            }}
                            className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                                activeIteration === idx
                                    ? 'bg-corporate-600 text-white'
                                    : 'bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:border-corporate-300'
                            }`}
                        >
                            {idx + 1}
                        </button>
                    ))}
                </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {/* Summary Cards */}
                {summary && (
                    <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Performance Summary</h3>
                            {!isRunning && results.length > 0 && (
                                <div className="flex items-center gap-1.5">
                                    <button
                                        onClick={() => {
                                            const xml = generateJunitXml(results, summary, runner.collectionName || 'TestOrbit Run');
                                            const safeName = (runner.collectionName || 'testorbit').replace(/[^a-zA-Z0-9_-]/g, '_');
                                            downloadFile(xml, `${safeName}_results.xml`, 'application/xml');
                                        }}
                                        className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-corporate-600 dark:hover:text-corporate-400 transition-colors px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        title="Export as JUnit XML (for CI/CD)"
                                    >
                                        <Download size={10} /> JUnit XML
                                    </button>
                                    <button
                                        onClick={() => {
                                            const html = generateHtmlReport(results, summary, runner.collectionName || 'TestOrbit Run');
                                            const safeName = (runner.collectionName || 'testorbit').replace(/[^a-zA-Z0-9_-]/g, '_');
                                            downloadFile(html, `${safeName}_report.html`, 'text/html');
                                        }}
                                        className="flex items-center gap-1 text-[10px] font-medium text-slate-500 dark:text-slate-400 hover:text-corporate-600 dark:hover:text-corporate-400 transition-colors px-2 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                                        title="Export as standalone HTML report"
                                    >
                                        <Download size={10} /> HTML Report
                                    </button>
                                </div>
                            )}
                        </div>
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
