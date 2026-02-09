import React, { useState, useEffect } from 'react';
import { Play, Activity, AlertCircle, CheckCircle, Clock, FileText, Copy, Download, Link, Code2 } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { CustomMethodSelect } from './CustomMethodSelect';
import { KeyValueEditor } from './KeyValueEditor';
import { JsonViewer } from './JsonViewer';
import { CodeGenModal } from './CodeGenModal';
import { runPreRequestScript, runPostResponseScript } from '../../utils/scriptEngine';
import { evaluateAssertions, createAssertion } from '../../utils/assertionEngine';

const API_BASE = "http://localhost:8000/api/v1";

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
    return `${base}?${enabled.map(p => `${p.key}=${p.value || ''}`).join('&')}`;
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
    const request = useWorkspaceStore(state => state.activeTabs.find(t => t.id === tabId));
    const responseEntry = useWorkspaceStore(state => state.responses[tabId]);

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

    useEffect(() => {
        setLocalUrl(request?.url || '');
    }, [request?.id]);

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

    // Actually execute the HTTP request via backend proxy
    const handleRun = async () => {
        if (!localUrl) {
            setResponseData(tabId, { error: 'Please enter a URL' }, null);
            return;
        }

        setResponseLoading(tabId, true);
        setScriptResults(null);
        setAssertionResults(null);
        const startTime = Date.now();

        // Resolve {{variable}} placeholders
        const resolvedUrl = resolveVariables(localUrl);

        // --- Run Pre-request Script ---
        let preResult = null;
        if (request.preScript?.trim()) {
            preResult = runPreRequestScript(request.preScript, {
                variables: { ...chainVars },
                environment: getEnvVars(),
                request: { ...request, url: resolvedUrl },
            });
            // Apply variable changes from pre-script
            if (preResult.updatedVars) {
                Object.entries(preResult.updatedVars).forEach(([k, v]) => {
                    if (chainVars[k] !== v) setChainVar(k, v);
                });
            }
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

            // Apply auth headers
            if (request.authType === 'bearer' && request.authToken) {
                headers['Authorization'] = `Bearer ${resolveVariables(request.authToken)}`;
            } else if (request.authType === 'basic' && request.authUsername) {
                headers['Authorization'] = `Basic ${btoa(`${resolveVariables(request.authUsername || '')}:${resolveVariables(request.authPassword || '')}`)}`;
            } else if (request.authType === 'apikey' && request.authKeyValue) {
                headers[resolveVariables(request.authKeyName || 'X-API-Key')] = resolveVariables(request.authKeyValue);
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
                }
            }

            // Use the proxy endpoint to avoid CORS issues
            const proxyRes = await fetch(`${API_BASE}/proxy`, {
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
            const elapsed = Date.now() - startTime;

            let responseData;
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

            // --- Run Post-response Script ---
            let postResult = null;
            if (request.postScript?.trim()) {
                postResult = runPostResponseScript(request.postScript, {
                    variables: preResult?.updatedVars || { ...chainVars },
                    environment: getEnvVars(),
                    request: { ...request, url: resolvedUrl, resolvedHeaders: headers },
                    response: responseData,
                    responseTime: elapsed,
                });
                // Apply variable changes from post-script
                if (postResult.updatedVars) {
                    Object.entries(postResult.updatedVars).forEach(([k, v]) => {
                        if (chainVars[k] !== v) setChainVar(k, v);
                    });
                }
            }

            setScriptResults({ pre: preResult, post: postResult });

            // --- Evaluate Assertions ---
            if (request.assertions?.length > 0 && responseData) {
                const aResults = evaluateAssertions(request.assertions, responseData, elapsed);
                setAssertionResults(aResults);
            }
        } catch (err) {
            const elapsed = Date.now() - startTime;
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
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Request Params/Body */}
                <div className="w-1/2 border-r border-slate-200 dark:border-slate-700 flex flex-col bg-white dark:bg-slate-900">
                    <div className="h-10 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center px-1 gap-1">
                        {['params', 'headers', 'body', 'auth', 'scripts', 'assertions'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveSubTab(tab)}
                                className={`
                            px-4 h-full text-xs font-semibold capitalize relative transition-colors
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
                                            } catch (e) {
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

                        {activeSubTab === 'auth' && (
                            <div className="p-4">
                                <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Authorization</div>
                                <div className="flex items-center gap-2 mb-3">
                                    <select
                                        value={request.authType || 'none'}
                                        onChange={(e) => handleChange('authType', e.target.value)}
                                        className="text-xs bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1.5 outline-none focus:ring-1 focus:ring-corporate-500 text-slate-700 dark:text-slate-300"
                                    >
                                        <option value="none">No Auth</option>
                                        <option value="bearer">Bearer Token</option>
                                        <option value="basic">Basic Auth</option>
                                        <option value="apikey">API Key</option>
                                    </select>
                                </div>

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
                                        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">Token will be sent as <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Authorization: Bearer &lt;token&gt;</code></p>
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
                                        </div>
                                    </div>
                                )}

                                {(!request.authType || request.authType === 'none') && (
                                    <p className="text-xs text-slate-400 dark:text-slate-500">No authorization headers will be added to this request.</p>
                                )}
                            </div>
                        )}

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
                                                className={`border rounded-lg p-3 transition-colors ${
                                                    assertion.enabled !== false
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
                                                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                                                            assertion.enabled !== false
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
                                                <div className="flex items-center gap-2 text-[10px]">
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
                                                            <option value="contains">contains</option>
                                                            {assertion.type === 'json_path' && <option value="exists">exists</option>}
                                                            {assertion.type === 'json_path' && <option value="is_type">is type</option>}
                                                        </select>
                                                    )}

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
                                    {['status_code', 'response_time', 'json_path', 'body_contains', 'header_contains'].map(type => (
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

                {/* Right: Response */}
                <div className="w-1/2 flex flex-col bg-slate-50 dark:bg-slate-800">
                    <div className="h-10 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center px-1 text-xs font-semibold text-slate-500 dark:text-slate-400 justify-between">
                        <div className="flex items-center gap-1 h-full">
                            {['body', 'headers', ...(scriptResults ? ['tests'] : []), ...(assertionResults?.total > 0 ? ['assertions'] : [])].map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setResponseTab(tab)}
                                    className={`px-3 h-full text-xs font-semibold capitalize relative transition-colors ${
                                        responseTab === tab
                                            ? 'text-corporate-600 after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-corporate-600'
                                            : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                    }`}
                                >
                                    {tab}
                                </button>
                            ))}
                        </div>
                        {response && (
                            <div className="flex gap-3 items-center pr-3">
                                <span className={`font-bold ${getStatusColor(response.status)}`}>
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
                                        <div key={r.id || i} className={`flex items-start gap-2 p-2.5 rounded-lg text-xs border ${
                                            r.passed
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
                                    <JsonViewer
                                        data={response.data}
                                        language={typeof response.data === 'object' ? 'json' : 'text'}
                                        maxHeight="350px"
                                    />

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
                                                    {Object.entries(chainVars).map(([k, v]) => (
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
