import React, { useState } from 'react';
import { Shield, Terminal, History, CheckCircle, XCircle, Settings, FileText, Play } from 'lucide-react';
import { useWorkspaceStore, flattenItems } from '../../store/workspaceStore';
import { API_BASE, authFetch } from '../../config';

// --- Collection-Level Auto-Auth Panel ---
const CollectionAutoAuthPanel = ({ collection, updateCollection }) => {
    const [tokenStatus, setTokenStatus] = useState(null);
    const [tokenError, setTokenError] = useState(null);

    const handleChange = (field, value) => {
        updateCollection(collection.id, { [field]: value });
    };

    const handleTestLogin = async () => {
        setTokenStatus('loading');
        setTokenError(null);
        try {
            let loginBody = null;
            const bodyStr = collection.autoAuthBody || '';
            if (bodyStr.trim()) {
                try { loginBody = JSON.parse(bodyStr); } catch { loginBody = bodyStr; }
            }
            const loginHeaders = { 'Content-Type': 'application/json' };
            (collection.autoAuthLoginHeaders || []).forEach(h => {
                if (h.key && h.key.trim()) loginHeaders[h.key.trim()] = h.value || '';
            });

            const res = await authFetch(`${API_BASE}/proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: collection.autoAuthLoginUrl,
                    method: collection.autoAuthMethod || 'POST',
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

            const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
            const tokenPath = (collection.autoAuthTokenPath || 'token').split('.');
            let token = result.data;
            for (const key of tokenPath) {
                if (BLOCKED_KEYS.has(key)) { token = null; break; }
                if (token && typeof token === 'object') token = token[key];
                else { token = null; break; }
            }

            if (!token || typeof token !== 'string') {
                setTokenStatus('error');
                setTokenError(`Could not find token at path "${collection.autoAuthTokenPath || 'token'}" in response`);
                return;
            }

            updateCollection(collection.id, { autoAuthToken: token, autoAuthTokenTime: Date.now() });
            setTokenStatus('success');
        } catch (err) {
            setTokenStatus('error');
            setTokenError(err.message);
        }
    };

    const inputClass = "w-full text-xs font-mono px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-corporate-500/30";
    const labelClass = "text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block";

    return (
        <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                    Configure a login endpoint. All requests in this collection will auto-login and attach the token.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                    <label className={labelClass}>Login URL</label>
                    <input
                        type="text"
                        value={collection.autoAuthLoginUrl || ''}
                        onChange={(e) => handleChange('autoAuthLoginUrl', e.target.value)}
                        placeholder="https://api.example.com/login"
                        className={inputClass}
                    />
                </div>

                <div>
                    <label className={labelClass}>Method</label>
                    <select
                        value={collection.autoAuthMethod || 'POST'}
                        onChange={(e) => handleChange('autoAuthMethod', e.target.value)}
                        className={inputClass}
                    >
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="GET">GET</option>
                    </select>
                </div>
                <div>
                    <label className={labelClass}>Token Path in Response</label>
                    <input
                        type="text"
                        value={collection.autoAuthTokenPath || ''}
                        onChange={(e) => handleChange('autoAuthTokenPath', e.target.value)}
                        placeholder="token (or data.access_token)"
                        className={inputClass}
                    />
                </div>
            </div>

            <div>
                <label className={labelClass}>Login Headers</label>
                <div className="space-y-2">
                    {(collection.autoAuthLoginHeaders || []).map((h, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                            <input
                                type="text"
                                value={h.key || ''}
                                onChange={e => {
                                    const updated = [...(collection.autoAuthLoginHeaders || [])];
                                    updated[idx] = { ...updated[idx], key: e.target.value };
                                    handleChange('autoAuthLoginHeaders', updated);
                                }}
                                placeholder="Header name"
                                className={`${inputClass} flex-1`}
                            />
                            <input
                                type="text"
                                value={h.value || ''}
                                onChange={e => {
                                    const updated = [...(collection.autoAuthLoginHeaders || [])];
                                    updated[idx] = { ...updated[idx], value: e.target.value };
                                    handleChange('autoAuthLoginHeaders', updated);
                                }}
                                placeholder="Value"
                                className={`${inputClass} flex-1`}
                            />
                            <button
                                onClick={() => handleChange('autoAuthLoginHeaders', (collection.autoAuthLoginHeaders || []).filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-red-500 text-xs px-1 shrink-0"
                            >
                                Remove
                            </button>
                        </div>
                    ))}
                    <button
                        onClick={() => handleChange('autoAuthLoginHeaders', [...(collection.autoAuthLoginHeaders || []), { key: '', value: '' }])}
                        className="text-xs text-corporate-600 dark:text-corporate-400 hover:underline"
                    >
                        + Add Header
                    </button>
                </div>
            </div>

            <div>
                <label className={labelClass}>Login Body (JSON)</label>
                <textarea
                    value={collection.autoAuthBody || ''}
                    onChange={(e) => handleChange('autoAuthBody', e.target.value)}
                    placeholder={'{"email": "user@example.com", "password": "pass"}'}
                    className={`${inputClass} resize-none`}
                    rows={5}
                />
            </div>

            <div className="flex items-center gap-3">
                <button
                    onClick={handleTestLogin}
                    disabled={tokenStatus === 'loading' || !collection.autoAuthLoginUrl}
                    className="px-4 py-2 text-xs font-semibold text-white bg-corporate-600 hover:bg-corporate-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 rounded-lg transition-colors"
                >
                    {tokenStatus === 'loading' ? 'Logging in...' : 'Test Login'}
                </button>
                {collection.autoAuthToken && (
                    <button
                        onClick={() => updateCollection(collection.id, { autoAuthToken: '', autoAuthTokenTime: null })}
                        className="px-3 py-2 text-xs text-slate-500 hover:text-red-500 transition-colors"
                    >
                        Clear Token
                    </button>
                )}
            </div>

            {collection.autoAuthToken && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-bold text-green-700 dark:text-green-400">
                            {tokenStatus === 'success' ? 'Token acquired' : 'Cached token'}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => { navigator.clipboard.writeText(collection.autoAuthToken); }}
                                className="text-[10px] px-2 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-700 transition-colors"
                            >Copy</button>
                            <button
                                onClick={handleTestLogin}
                                disabled={tokenStatus === 'loading' || !collection.autoAuthLoginUrl}
                                className="text-[10px] px-2 py-1 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-700 transition-colors disabled:opacity-50"
                            >Refresh</button>
                        </div>
                    </div>
                    <code className="text-xs text-green-800 dark:text-green-300 break-all block font-mono">
                        {collection.autoAuthToken.length > 80 ? collection.autoAuthToken.slice(0, 80) + '...' : collection.autoAuthToken}
                    </code>
                    {collection.autoAuthTokenTime && (
                        <span className="text-[10px] text-green-500 dark:text-green-500 mt-1 block">
                            Acquired: {new Date(collection.autoAuthTokenTime).toLocaleString()}
                        </span>
                    )}
                </div>
            )}

            {tokenStatus === 'error' && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <span className="text-xs font-bold text-red-600 dark:text-red-400">Login Failed</span>
                    <p className="text-xs text-red-500 dark:text-red-400 mt-1 break-all">{tokenError}</p>
                </div>
            )}

            <p className="text-xs text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-3">
                Token refreshes automatically if older than 30 min. Sent as <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded text-[10px]">Authorization: Bearer &lt;token&gt;</code>
            </p>
        </div>
    );
};


// === Main Collection Settings Component ===
export const CollectionSettings = ({ collectionId }) => {
    const collections = useWorkspaceStore(state => state.collections);
    const updateCollection = useWorkspaceStore(state => state.updateCollection);
    const openRunner = useWorkspaceStore(state => state.openRunner);
    const viewRunFromHistory = useWorkspaceStore(state => state.viewRunFromHistory);

    const collection = collections.find(c => c.id === collectionId);
    const [activeTab, setActiveTab] = useState('auth');

    if (!collection) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500 text-sm">
                Collection not found
            </div>
        );
    }

    const requestCount = flattenItems(collection.items, 'request').length;
    const folderCount = flattenItems(collection.items, 'folder').length;
    const wsCount = flattenItems(collection.items, 'websocket').length;
    const runHistory = collection.runHistory || [];

    const tabs = [
        { id: 'auth', label: 'Auth', icon: Shield },
        { id: 'scripts', label: 'Scripts', icon: Terminal },
        { id: 'runs', label: 'Runs', icon: History, badge: runHistory.length || null },
        { id: 'overview', label: 'Overview', icon: Settings },
    ];

    const inputClass = "w-full text-xs font-mono px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-corporate-500/30 text-slate-700";

    return (
        <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-6 py-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                            {collection.name}
                        </h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                            Collection Settings — {requestCount} request{requestCount !== 1 ? 's' : ''}
                            {folderCount > 0 && ` · ${folderCount} folder${folderCount !== 1 ? 's' : ''}`}
                            {wsCount > 0 && ` · ${wsCount} WebSocket${wsCount !== 1 ? 's' : ''}`}
                        </p>
                    </div>
                    <button
                        onClick={() => openRunner(collectionId)}
                        className="flex items-center gap-2 px-4 py-2 bg-corporate-600 hover:bg-corporate-700 text-white text-xs font-semibold rounded-lg transition-colors"
                    >
                        <Play size={14} />
                        Run All
                    </button>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-6">
                <div className="flex gap-1">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-semibold border-b-2 transition-colors ${activeTab === tab.id
                                ? 'border-corporate-600 text-corporate-600 dark:text-corporate-400'
                                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                }`}
                        >
                            <tab.icon size={13} />
                            {tab.label}
                            {tab.badge && (
                                <span className="text-[9px] bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1.5 py-0.5 rounded-full">{tab.badge}</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'auth' && (
                    <AuthTabContent
                        key={collectionId}
                        collection={collection}
                        updateCollection={updateCollection}
                        inputClass={inputClass}
                    />
                )}

                {activeTab === 'scripts' && (
                    <ScriptsTabContent
                        collection={collection}
                        updateCollection={updateCollection}
                    />
                )}

                {activeTab === 'runs' && (
                    <RunsTabContent
                        collection={collection}
                        runHistory={runHistory}
                        viewRunFromHistory={viewRunFromHistory}
                    />
                )}

                {activeTab === 'overview' && (
                    <OverviewTabContent
                        collection={collection}
                        updateCollection={updateCollection}
                        requestCount={requestCount}
                        folderCount={folderCount}
                        runHistory={runHistory}
                    />
                )}
            </div>
        </div>
    );
};


// === Auth Tab ===
const AuthTabContent = ({ collection, updateCollection, inputClass }) => {
    const AUTH_LABELS = { bearer: 'Bearer Token', basic: 'Basic Auth', apikey: 'API Key', 'auto-auth': 'Auto-Auth (Login → Token)' };

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Collection Authorization</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    All requests in this collection inherit this auth unless they override it with their own.
                </p>
            </div>

            {/* Force Auth Toggle */}
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg">
                <div>
                    <span className="text-xs font-semibold text-amber-800 dark:text-amber-300">Force on all requests</span>
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Override individual request auth settings</p>
                </div>
                <button
                    onClick={() => updateCollection(collection.id, { forceCollectionAuth: !collection.forceCollectionAuth })}
                    className={`relative w-10 h-5 rounded-full transition-colors ${collection.forceCollectionAuth ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${collection.forceCollectionAuth ? 'left-5' : 'left-0.5'}`} />
                </button>
            </div>

            <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5 block">Auth Type</label>
                <select
                    value={collection.authType || 'none'}
                    onChange={(e) => updateCollection(collection.id, { authType: e.target.value })}
                    className={`${inputClass} max-w-xs`}
                >
                    <option value="none">No Auth</option>
                    <option value="bearer">Bearer Token</option>
                    <option value="basic">Basic Auth</option>
                    <option value="apikey">API Key</option>
                    <option value="auto-auth">Auto-Auth (Login → Token)</option>
                </select>
            </div>

            {collection.authType === 'bearer' && (
                <div>
                    <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Token</label>
                    <textarea
                        value={collection.authToken || ''}
                        onChange={(e) => updateCollection(collection.id, { authToken: e.target.value })}
                        placeholder="Paste your Bearer token here or use {{token_var}}"
                        className={`${inputClass} resize-none`}
                        rows={4}
                    />
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                        Sent as <code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Authorization: Bearer &lt;token&gt;</code>
                    </p>
                </div>
            )}

            {collection.authType === 'basic' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Username</label>
                        <input
                            type="text"
                            value={collection.authUsername || ''}
                            onChange={(e) => updateCollection(collection.id, { authUsername: e.target.value })}
                            placeholder="username"
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Password</label>
                        <input
                            type="password"
                            value={collection.authPassword || ''}
                            onChange={(e) => updateCollection(collection.id, { authPassword: e.target.value })}
                            placeholder="password"
                            className={inputClass}
                        />
                    </div>
                </div>
            )}

            {collection.authType === 'apikey' && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Header Name</label>
                        <input
                            type="text"
                            value={collection.authKeyName || 'X-API-Key'}
                            onChange={(e) => updateCollection(collection.id, { authKeyName: e.target.value })}
                            className={inputClass}
                        />
                    </div>
                    <div>
                        <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">API Key Value</label>
                        <input
                            type="text"
                            value={collection.authKeyValue || ''}
                            onChange={(e) => updateCollection(collection.id, { authKeyValue: e.target.value })}
                            placeholder="Your API key or use {{api_key}}"
                            className={inputClass}
                        />
                    </div>
                </div>
            )}

            {collection.authType === 'auto-auth' && (
                <CollectionAutoAuthPanel key={collection.id} collection={collection} updateCollection={updateCollection} />
            )}

            {(!collection.authType || collection.authType === 'none') && (
                <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        No authorization headers will be added. Requests can set their own auth individually.
                    </p>
                </div>
            )}

            {collection.authType && collection.authType !== 'none' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                        {collection.forceCollectionAuth
                            ? 'All endpoints will use this auth. Individual endpoint auth is overridden.'
                            : 'Endpoints set to "Inherit from Collection" or with no auth type will use this. Endpoints with their own auth type will use their own.'
                        }
                    </p>
                </div>
            )}
        </div>
    );
};


// === Scripts Tab ===
const ScriptsTabContent = ({ collection, updateCollection }) => {
    return (
        <div className="max-w-3xl space-y-6">
            <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Collection Scripts</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    These scripts run before/after every request in this collection (before individual request scripts).
                </p>
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pre-request Script</label>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Runs before the request is sent</span>
                </div>
                <textarea
                    value={collection.preScript || ''}
                    onChange={(e) => updateCollection(collection.id, { preScript: e.target.value })}
                    placeholder={'// Runs before each request in this collection\n// Available: pm.variables.set(k,v), pm.variables.get(k)\npm.variables.set(\'token\', \'abc\');'}
                    rows={8}
                    className="w-full text-xs font-mono px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-900 text-green-400 outline-none focus:ring-2 focus:ring-corporate-500/30 resize-none placeholder-slate-600"
                />
            </div>

            <div>
                <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Post-response Script</label>
                    <span className="text-[10px] text-slate-400 dark:text-slate-500">Runs after the response is received</span>
                </div>
                <textarea
                    value={collection.postScript || ''}
                    onChange={(e) => updateCollection(collection.id, { postScript: e.target.value })}
                    placeholder={'// Runs after each request in this collection\npm.test(\'Status OK\', () => pm.expect(pm.response.status).to.equal(200));'}
                    rows={8}
                    className="w-full text-xs font-mono px-4 py-3 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-900 text-green-400 outline-none focus:ring-2 focus:ring-corporate-500/30 resize-none placeholder-slate-600"
                />
            </div>
        </div>
    );
};


// === Runs Tab ===
const RunsTabContent = ({ collection, runHistory, viewRunFromHistory }) => {
    if (runHistory.length === 0) {
        return (
            <div className="text-center py-16">
                <History size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" strokeWidth={1} />
                <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No runs yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Run this collection to see results here</p>
            </div>
        );
    }

    const totalPassed = runHistory.reduce((sum, r) => sum + (r.summary?.passed || 0), 0);
    const totalFailed = runHistory.reduce((sum, r) => sum + (r.summary?.failed || 0), 0);
    const avgTime = Math.round(runHistory.reduce((sum, r) => sum + (r.summary?.totalTime || 0), 0) / runHistory.length);

    return (
        <div className="space-y-6">
            {/* Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center">
                    <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">{runHistory.length}</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Total Runs</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-800 rounded-lg p-3 text-center">
                    <span className="text-2xl font-bold text-green-600 dark:text-green-400">{totalPassed}</span>
                    <p className="text-[10px] text-green-600 dark:text-green-400 mt-0.5">Total Passed</p>
                </div>
                <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg p-3 text-center">
                    <span className="text-2xl font-bold text-red-600 dark:text-red-400">{totalFailed}</span>
                    <p className="text-[10px] text-red-600 dark:text-red-400 mt-0.5">Total Failed</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-center">
                    <span className="text-2xl font-bold text-slate-700 dark:text-slate-200">{avgTime}ms</span>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Avg Time</p>
                </div>
            </div>

            {/* Run History List */}
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Run History</span>
                </div>
                {runHistory.map((run, idx) => {
                    const passRate = (run.summary?.passed || 0) + (run.summary?.failed || 0) > 0
                        ? Math.round(((run.summary?.passed || 0) / ((run.summary?.passed || 0) + (run.summary?.failed || 0))) * 100)
                        : 0;

                    return (
                        <button
                            key={run.id || idx}
                            onClick={() => viewRunFromHistory(run.id)}
                            className={`w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors flex items-center justify-between ${idx < runHistory.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <div className={`w-2.5 h-2.5 rounded-full ${(run.summary?.failed || 0) > 0 ? 'bg-amber-400' : 'bg-green-400'}`} />
                                <div>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{run.collectionName || collection.name}</span>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                        {new Date(run.timestamp).toLocaleString()} — {run.summary?.totalTime || 0}ms
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-4 text-xs">
                                <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <CheckCircle size={12} /> {run.summary?.passed || 0}
                                </span>
                                {(run.summary?.failed || 0) > 0 && (
                                    <span className="flex items-center gap-1 text-red-500 dark:text-red-400">
                                        <XCircle size={12} /> {run.summary.failed}
                                    </span>
                                )}
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${passRate === 100 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : passRate >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'}`}>
                                    {passRate}%
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};


// === Overview Tab ===
const OverviewTabContent = ({ collection, updateCollection, requestCount, folderCount, runHistory }) => {
    const [editingName, setEditingName] = useState(false);
    const [nameValue, setNameValue] = useState(collection.name);

    const handleSaveName = () => {
        if (nameValue.trim() && nameValue.trim() !== collection.name) {
            updateCollection(collection.id, { name: nameValue.trim() });
        }
        setEditingName(false);
    };

    const lastRun = runHistory[0];

    return (
        <div className="max-w-2xl space-y-6">
            <div>
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-1">Collection Overview</h3>
            </div>

            {/* Name */}
            <div>
                <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1 block">Collection Name</label>
                {editingName ? (
                    <div className="flex gap-2">
                        <input
                            autoFocus
                            type="text"
                            value={nameValue}
                            onChange={(e) => setNameValue(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                            className="flex-1 text-sm font-medium px-3 py-2 border border-corporate-400 rounded-lg outline-none focus:ring-2 focus:ring-corporate-500/30 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                        />
                        <button onClick={handleSaveName} className="px-3 py-2 text-xs font-semibold bg-corporate-600 text-white rounded-lg hover:bg-corporate-700 transition-colors">Save</button>
                        <button onClick={() => setEditingName(false)} className="px-3 py-2 text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">Cancel</button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{collection.name}</span>
                        <button onClick={() => { setNameValue(collection.name); setEditingName(true); }} className="text-[10px] text-corporate-600 dark:text-corporate-400 hover:underline">Edit</button>
                    </div>
                )}
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                        <FileText size={12} className="text-slate-400" />
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Requests</span>
                    </div>
                    <span className="text-xl font-bold text-slate-700 dark:text-slate-200">{requestCount}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Folders</span>
                    </div>
                    <span className="text-xl font-bold text-slate-700 dark:text-slate-200">{folderCount}</span>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[10px] text-slate-500 dark:text-slate-400">Runs</span>
                    </div>
                    <span className="text-xl font-bold text-slate-700 dark:text-slate-200">{runHistory.length}</span>
                </div>
                {lastRun && (
                    <div className="bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
                        <div className="flex items-center gap-1.5 mb-1">
                            <span className="text-[10px] text-slate-500 dark:text-slate-400">Last Run</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-green-600 dark:text-green-400">{lastRun.summary?.passed || 0}</span>
                            <span className="text-[10px] text-slate-400">/</span>
                            <span className="text-xs font-bold text-red-500 dark:text-red-400">{lastRun.summary?.failed || 0}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Auth Status */}
            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                    <Shield size={12} className="text-slate-400" />
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Auth Status</span>
                </div>
                <span className="text-xs text-slate-700 dark:text-slate-300">
                    {{ none: 'No Auth', bearer: 'Bearer Token', basic: 'Basic Auth', apikey: 'API Key', 'auto-auth': 'Auto-Auth' }[collection.authType] || 'No Auth'}
                    {collection.forceCollectionAuth && (
                        <span className="ml-2 text-[10px] bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded">Forced</span>
                    )}
                </span>
            </div>
        </div>
    );
};
