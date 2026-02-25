import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowRight, Zap, Activity, Play, FileText, ChevronDown, ChevronUp, Trash2, User, Download, Folder, MessageSquare, Code, FlaskConical, FileCode, CheckCircle, XCircle, FolderInput } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { JsonViewer } from './JsonViewer';
import yaml from 'js-yaml';

import { API_BASE, authFetch } from '../../config';

const EMPTY_MESSAGES = [];
const EMPTY_SUITES = [];

// Streaming text component — reveals text word-by-word
const StreamingText = ({ text, className = '' }) => {
    const [displayed, setDisplayed] = useState('');
    const [done, setDone] = useState(false);

    useEffect(() => {
        if (!text) return;
        const words = text.split(' ');
        let i = 0;
        setDisplayed('');
        setDone(false);
        const timer = setInterval(() => {
            i++;
            if (i >= words.length) {
                setDisplayed(text);
                setDone(true);
                clearInterval(timer);
            } else {
                setDisplayed(words.slice(0, i).join(' '));
            }
        }, 30);
        return () => clearInterval(timer);
    }, [text]);

    return (
        <span className={className}>
            {displayed}
            {!done && <span className="animate-blink ml-0.5">|</span>}
        </span>
    );
};

export const IntelligencePanel = () => {
    const [activeTab, setActiveTab] = useState('chat');
    const [prompt, setPrompt] = useState('');
    const [loading, setLoading] = useState(false);
    const [executing, setExecuting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [localSpec, setLocalSpec] = useState('');
    const [useSpecContext, setUseSpecContext] = useState(true);
    const [localBaseUrl, setLocalBaseUrl] = useState('');
    const [generating, setGenerating] = useState(false);
    const [testPrompt, setTestPrompt] = useState('');
    const [fetchingSpec, setFetchingSpec] = useState(false);
    const chatEndRef = useRef(null);

    // Store state — per-collection
    const activeCollectionId = useWorkspaceStore(state => state.activeCollectionId);
    const collections = useWorkspaceStore(state => state.collections);
    const activeCollection = collections.find(c => c.id === activeCollectionId);

    const messages = activeCollection?.chatMessages || EMPTY_MESSAGES;
    const openApiSpec = activeCollection?.openApiSpec || '';

    const addCollectionChatMessage = useWorkspaceStore(state => state.addCollectionChatMessage);
    const updateCollectionChatMessage = useWorkspaceStore(state => state.updateCollectionChatMessage);
    const clearCollectionChat = useWorkspaceStore(state => state.clearCollectionChat);
    const setCollectionOpenApiSpec = useWorkspaceStore(state => state.setCollectionOpenApiSpec);
    const setCollectionBaseUrl = useWorkspaceStore(state => state.setCollectionBaseUrl);
    const createRequestFromAI = useWorkspaceStore(state => state.createRequestFromAI);
    const importFromOpenApiSpec = useWorkspaceStore(state => state.importFromOpenApiSpec);
    const addTestSuite = useWorkspaceStore(state => state.addTestSuite);
    const deleteTestSuite = useWorkspaceStore(state => state.deleteTestSuite);
    const openRunnerForTestSuite = useWorkspaceStore(state => state.openRunnerForTestSuite);

    const testSuites = activeCollection?.testSuites || EMPTY_SUITES;

    // Sync local spec text and base URL when switching collections
    useEffect(() => {
        setLocalSpec(activeCollection?.openApiSpec || '');
        setLocalBaseUrl(activeCollection?.baseUrl || '');
        setImportResult(null);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCollectionId]);

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, loading]);

    const extractUrlFromPrompt = (text) => {
        const urlMatch = text.match(/https?:\/\/[^\s]+/);
        return urlMatch ? urlMatch[0] : '';
    };

    // Safely convert any error value (string, array, object) to a displayable string
    const safeErrorMessage = (err) => {
        if (!err) return 'Unknown error';
        if (typeof err === 'string') return err;
        // Pydantic validation errors come as an array of {type, loc, msg, input, ctx}
        if (Array.isArray(err)) {
            return err.map(e => {
                if (typeof e === 'string') return e;
                if (e?.msg) return `${e.loc ? e.loc.join(' \u2192 ') + ': ' : ''}${e.msg}`;
                return JSON.stringify(e);
            }).join('\n');
        }
        if (err?.message) return err.message;
        if (err?.msg) return err.msg;
        return JSON.stringify(err, null, 2);
    };

    const handleExecute = async () => {
        if (!prompt.trim() || !activeCollectionId || loading) return;

        const userMessage = { role: 'user', content: prompt.trim() };
        addCollectionChatMessage(userMessage);
        setPrompt('');
        setLoading(true);

        try {
            // Build conversation history for multi-turn context
            const history = messages.map(m => {
                if (m.role === 'user') return { role: 'user', content: m.content };
                if (m.role === 'assistant') {
                    if (m.data?.type === 'chat') {
                        return { role: 'assistant', content: m.data.response || '' };
                    }
                    // Free chat mode: drop spec-derived voice suggestions from context
                    // to prevent Gemini anchoring on stale spec endpoints
                    if (!useSpecContext) return null;
                    return {
                        role: 'assistant',
                        content: `${m.data?.explanation || ''} | Method: ${m.data?.method || ''} | URL: ${m.data?.extracted_url || ''}`
                    };
                }
                return null;
            }).filter(Boolean);

            // Route based on message content:
            // - URL in message → /voice (payload generator with Apply/Run)
            // - Endpoint/test intent keywords → /voice (structured endpoint response)
            // - Everything else → /chat (conversational)
            const hasUrl = useSpecContext && /https?:\/\/[^\s]+/.test(userMessage.content);
            const hasEndpointIntent = useSpecContext && openApiSpec && /\b(endpoint|test|give\s+me|try|run|send|hit|call|request|fetch|get|post|put|patch|delete|create|update|list|retrieve)\b/i.test(userMessage.content);

            if (hasUrl || hasEndpointIntent) {
                const res = await authFetch(`${API_BASE}/voice`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        transcript: userMessage.content,
                        openapi_spec: useSpecContext ? (openApiSpec || null) : null,
                        conversation_history: history,
                        base_url: activeCollection?.baseUrl || null,
                    })
                });
                if (!res.ok) {
                    const errData = await res.json();
                    const errMsg = safeErrorMessage(errData.error?.message || errData.error || errData.detail || 'Request failed');
                    addCollectionChatMessage({ role: 'error', content: errMsg });
                    return;
                }
                let data = await res.json();
                // Defensive: if Gemini returned a raw array, normalize to expected shape
                if (Array.isArray(data)) {
                    data = {
                        method: data[0]?.method || 'GET',
                        url: data[0]?.url || '',
                        suggested_body: data[0]?.suggested_body || null,
                        explanation: data.map(ep => `• **${ep.method || '?'} ${ep.url || '?'}** — ${ep.explanation || ''}`).join('\n'),
                        endpoints: data,
                    };
                }
                let rawUrl = data.url || extractUrlFromPrompt(userMessage.content);
                // If the AI returned a relative path (e.g. /v1/banks), prepend the collection's base URL
                const collectionBaseUrl = activeCollection?.baseUrl || '';
                if (rawUrl && !rawUrl.startsWith('http') && collectionBaseUrl) {
                    rawUrl = collectionBaseUrl.replace(/\/+$/, '') + (rawUrl.startsWith('/') ? '' : '/') + rawUrl;
                }
                data.extracted_url = rawUrl;
                // Also resolve relative URLs in individual endpoints
                if (data.endpoints) {
                    data.endpoints = data.endpoints.map(ep => {
                        let epUrl = ep.url || '';
                        if (epUrl && !epUrl.startsWith('http') && collectionBaseUrl) {
                            epUrl = collectionBaseUrl.replace(/\/+$/, '') + (epUrl.startsWith('/') ? '' : '/') + epUrl;
                        }
                        return { ...ep, url: epUrl };
                    });
                }
                if (data.error) {
                    addCollectionChatMessage({ role: 'error', content: safeErrorMessage(data.error?.message || data.error) });
                } else {
                    addCollectionChatMessage({ role: 'assistant', data });
                }
            } else {
                const res = await authFetch(`${API_BASE}/chat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: userMessage.content,
                        conversation_history: history,
                        context: useSpecContext ? (openApiSpec || null) : null
                    })
                });
                if (!res.ok) {
                    const errData = await res.json();
                    const errMsg = safeErrorMessage(errData.error?.message || errData.error || errData.detail || 'AI service error');
                    addCollectionChatMessage({ role: 'error', content: errMsg });
                    return;
                }
                const data = await res.json();
                if (data.error) {
                    addCollectionChatMessage({ role: 'error', content: safeErrorMessage(data.error?.message || data.error) });
                } else {
                    addCollectionChatMessage({ role: 'assistant', data: { type: 'chat', response: data.response } });
                }
            }
        } catch (e) {
            console.error(e);
            addCollectionChatMessage({
                role: 'error',
                content: 'Failed to connect to AI service. Is the backend running?'
            });
        } finally {
            setLoading(false);
        }
    };

    const handleApplyAndRun = async (msgIndex, shouldRun = false) => {
        const msg = messages[msgIndex];
        if (!msg || msg.role !== 'assistant') return;

        const { data } = msg;
        const url = data.extracted_url || '';
        const method = data.method || 'POST';
        const body = data.suggested_body;

        createRequestFromAI({
            method,
            url,
            body,
            name: `AI: ${method} ${url.split('/').pop() || 'Request'}`
        });

        if (shouldRun && url) {
            setExecuting(true);
            try {
                const parsedBody = (() => {
                    if (!body) return null;
                    if (typeof body === 'string') { try { return JSON.parse(body); } catch { return null; } }
                    return body;
                })();
                const proxyRes = await authFetch(`${API_BASE}/proxy`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url,
                        method,
                        body: parsedBody,
                        headers: { 'Content-Type': 'application/json' }
                    })
                });
                const result = await proxyRes.json();

                updateCollectionChatMessage(msgIndex, {
                    executionResult: {
                        status: result.status,
                        statusText: result.statusText,
                        data: result.data,
                        success: result.status >= 200 && result.status < 300
                    }
                });
            } catch (e) {
                updateCollectionChatMessage(msgIndex, {
                    executionResult: {
                        status: 0,
                        statusText: 'Error',
                        data: e.message,
                        success: false
                    }
                });
            } finally {
                setExecuting(false);
            }
        }
    };

    const handleImportSpec = () => {
        if (!localSpec.trim()) return;
        // Save spec to collection first
        setCollectionOpenApiSpec(localSpec);
        // Then import endpoints — pass base URL override for specs without servers field
        const result = importFromOpenApiSpec(localSpec, localBaseUrl.trim() || undefined);
        setImportResult(result);
    };

    const handleFetchSpec = async () => {
        const base = localBaseUrl.trim().replace(/\/+$/, '');
        if (!base) return;
        setFetchingSpec(true);
        setImportResult(null);
        const specPaths = ['/openapi.json', '/swagger.json', '/api-docs', '/docs/openapi.json', '/v3/api-docs', '/swagger/v1/swagger.json', '/openapi.yaml'];
        try {
            for (const path of specPaths) {
                try {
                    const res = await authFetch(`${API_BASE}/proxy`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: `${base}${path}`, method: 'GET', headers: {}, body: null })
                    });
                    const result = await res.json();
                    if (result.status >= 200 && result.status < 300 && result.data) {
                        const specText = typeof result.data === 'string' ? result.data : JSON.stringify(result.data, null, 2);
                        // Validate it looks like an OpenAPI spec
                        let parsed;
                        try { parsed = typeof result.data === 'string' ? JSON.parse(result.data) : result.data; } catch { parsed = null; }
                        if (parsed && (parsed.openapi || parsed.swagger || parsed.paths)) {
                            setLocalSpec(specText);
                            setCollectionOpenApiSpec(specText);
                            // Auto-detect base URL from spec
                            const specBase = parsed?.servers?.[0]?.url;
                            if (specBase && !localBaseUrl.trim()) { setLocalBaseUrl(specBase); setCollectionBaseUrl(specBase); }
                            setImportResult({ success: true, saved: true, fetched: path });
                            return;
                        }
                    }
                } catch { /* try next path */ }
            }
            setImportResult({ success: false, error: `No OpenAPI spec found at ${base}. Tried: ${specPaths.join(', ')}` });
        } finally {
            setFetchingSpec(false);
        }
    };

    const handleGenerateTests = async () => {
        if (!activeCollectionId) return;
        setGenerating(true);
        try {
            const col = activeCollection;
            const baseUrl = col?.baseUrl || col?.items?.[0]?.url || '';
            const context = `Collection: ${col?.name}, Endpoints: ${(col?.items || []).map(i => `${i.method} ${i.url}`).join(', ')}`;
            const res = await authFetch(`${API_BASE}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: baseUrl,
                    context,
                    openapi_spec: openApiSpec || undefined,
                    user_instructions: testPrompt.trim() || undefined,
                    base_url: col?.baseUrl || undefined,
                })
            });
            const data = await res.json();
            const errMsg = data.error || data.detail;
            if (!res.ok || errMsg) {
                alert(`Test generation failed: ${errMsg || 'Unknown error'}`);
            } else {
                addTestSuite(activeCollectionId, data);
            }
        } catch (e) {
            alert(`Failed to connect to AI service: ${e.message}`);
        } finally {
            setGenerating(false);
        }
    };

    const CATEGORY_COLORS = {
        happy_path: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
        edge_case: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
        security: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
        performance: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    };

    const METHOD_COLORS = {
        GET: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400',
        POST: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400',
        PUT: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400',
        DELETE: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400',
        PATCH: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400',
    };

    // No collection selected
    if (!activeCollection) {
        return (
            <div className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 h-full flex flex-col items-center justify-center font-sans text-slate-400 dark:text-slate-500">
                <Folder size={32} strokeWidth={1} className="mb-3 text-slate-300 dark:text-slate-600" />
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No Collection Selected</p>
                <p className="text-xs text-center mt-1 px-6">Select a collection from the explorer to use the Intelligence Panel.</p>
            </div>
        );
    }

    return (
        <div className="w-80 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-700 h-full flex flex-col font-sans">
            {/* Header */}
            <div className="h-10 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 justify-between bg-slate-50 dark:bg-slate-800">
                <div className="flex items-center gap-2 text-corporate-700 dark:text-corporate-400">
                    <Sparkles size={14} />
                    <span className="text-xs font-bold uppercase tracking-wider">Intelligence</span>
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate max-w-[100px]" title={activeCollection.name}>
                        {activeCollection.name}
                    </span>
                    <div className="w-2 h-2 bg-green-500 rounded-full" title="AI Connected"></div>
                </div>
            </div>

            {/* Tab Bar */}
            <div className="h-9 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center px-1 gap-0.5">
                {[
                    { id: 'chat', label: 'Chat', icon: MessageSquare },
                    { id: 'spec', label: 'Spec', icon: Code },
                    { id: 'tests', label: 'Tests', icon: FlaskConical },
                ].map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold rounded-md transition-colors ${activeTab === tab.id
                            ? 'bg-corporate-50 text-corporate-700 dark:bg-corporate-900/30 dark:text-corporate-400'
                            : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:text-slate-500 dark:hover:text-slate-300 dark:hover:bg-slate-800'
                            }`}
                    >
                        <tab.icon size={12} />
                        {tab.label}
                        {tab.id === 'tests' && testSuites.length > 0 && (
                            <span className="text-[9px] bg-corporate-100 text-corporate-600 dark:bg-corporate-900/30 dark:text-corporate-400 px-1 rounded-full">{testSuites.length}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ======================== CHAT TAB ======================== */}
            {activeTab === 'chat' && (
                <>
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-4">
                            {messages.length === 0 && (
                                <div className="bg-corporate-50 dark:bg-corporate-900/30 border border-corporate-100 dark:border-corporate-800 rounded-lg p-4 mb-4">
                                    <h4 className="text-corporate-800 dark:text-corporate-200 text-sm font-semibold mb-1 flex items-center gap-2">
                                        <Zap size={14} className="fill-corporate-600 text-corporate-600 dark:text-corporate-400" />
                                        AI Assistant
                                    </h4>
                                    <p className="text-corporate-600 dark:text-corporate-400 text-xs leading-5">
                                        {useSpecContext
                                            ? "Tell me what API to test. I'll use this collection's OpenAPI spec as context."
                                            : "Free chat mode — I'll answer based on your input only. No spec context used."}
                                    </p>
                                    {useSpecContext && openApiSpec && (
                                        <p className="text-corporate-500 text-[10px] mt-1 flex items-center gap-1">
                                            <Code size={10} /> Spec loaded — AI will use it for accurate suggestions
                                        </p>
                                    )}
                                </div>
                            )}

                            {messages.map((msg, idx) => (
                                <div key={idx} className="mb-3 animate-slide-up">
                                    {msg.role === 'user' && (
                                        <div className="flex gap-2 items-start">
                                            <div className="w-5 h-5 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                                                <User size={10} className="text-slate-500 dark:text-slate-400" />
                                            </div>
                                            <div className="bg-slate-100 dark:bg-slate-800 rounded-lg px-3 py-2 text-xs text-slate-700 dark:text-slate-300 max-w-full break-words">
                                                {msg.content}
                                            </div>
                                        </div>
                                    )}

                                    {msg.role === 'assistant' && (
                                        <div className="flex gap-2 items-start">
                                            <div className="w-5 h-5 rounded-full bg-corporate-100 dark:bg-corporate-900/30 flex items-center justify-center shrink-0 mt-0.5">
                                                <Sparkles size={10} className="text-corporate-600 dark:text-corporate-400" />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                {msg.data?.type === 'chat' ? (() => {
                                                    const responseText = typeof msg.data.response === 'string' ? msg.data.response : JSON.stringify(msg.data.response, null, 2);
                                                    // Try to extract an HTTP method + URL from the response text
                                                    const methodUrlMatch = responseText.match(/\b(GET|POST|PUT|PATCH|DELETE)\b[^\S\n]+([`'"]?(https?:\/\/[^\s`'")\]]+|\/[^\s`'")\]]+)[`'"]?)/i);
                                                    const standaloneUrlMatch = responseText.match(/https?:\/\/[^\s`'")\]]+/);
                                                    const extractedMethod = methodUrlMatch ? methodUrlMatch[1].toUpperCase() : 'POST';
                                                    const extractedUrl = methodUrlMatch
                                                        ? methodUrlMatch[2].replace(/[`'"]/g, '')
                                                        : (standaloneUrlMatch ? standaloneUrlMatch[0] : null);
                                                    // Try to extract a JSON body from code blocks
                                                    const bodyMatch = responseText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
                                                    const extractedBody = bodyMatch ? bodyMatch[1] : null;

                                                    return (
                                                        <div className="bg-corporate-50 dark:bg-corporate-900/30 border border-corporate-100 dark:border-corporate-800 rounded-lg p-3">
                                                            <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                                {idx === messages.length - 1
                                                                    ? <StreamingText text={responseText} />
                                                                    : responseText}
                                                            </p>
                                                            {extractedUrl && (
                                                                <div className="mt-3 border-t border-corporate-100 dark:border-corporate-800 pt-2">
                                                                    <div className="flex items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400 mb-2 font-mono">
                                                                        <span className="font-bold text-corporate-600 dark:text-corporate-400">{extractedMethod}</span>
                                                                        <span className="break-all">{extractedUrl}</span>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => {
                                                                                createRequestFromAI({
                                                                                    method: extractedMethod,
                                                                                    url: extractedUrl,
                                                                                    body: extractedBody,
                                                                                    name: `AI: ${extractedMethod} ${extractedUrl.split('/').pop() || 'Request'}`
                                                                                });
                                                                            }}
                                                                            className="flex-1 bg-corporate-600 hover:bg-corporate-700 text-white text-[10px] font-bold py-1.5 rounded transition-colors"
                                                                        >
                                                                            Apply
                                                                        </button>
                                                                        <button
                                                                            onClick={async () => {
                                                                                createRequestFromAI({
                                                                                    method: extractedMethod,
                                                                                    url: extractedUrl,
                                                                                    body: extractedBody,
                                                                                    name: `AI: ${extractedMethod} ${extractedUrl.split('/').pop() || 'Request'}`
                                                                                });
                                                                                // Small delay to let the tab open, then trigger run
                                                                                setTimeout(() => {
                                                                                    const runBtn = document.querySelector('[data-run-btn="true"]');
                                                                                    if (runBtn) runBtn.click();
                                                                                }, 300);
                                                                            }}
                                                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                                                                        >
                                                                            <Play size={10} className="fill-current" />
                                                                            <span>Apply & Run</span>
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })() : (
                                                    <div className="bg-corporate-50 dark:bg-corporate-900/30 border border-corporate-100 dark:border-corporate-800 rounded-lg p-3">
                                                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1 flex justify-between">
                                                            <span>Suggestion</span>
                                                            <span className="text-corporate-600 dark:text-corporate-400">{msg.data.method}</span>
                                                        </div>
                                                        <div className="text-xs text-slate-700 dark:text-slate-300 mb-2 leading-relaxed whitespace-pre-wrap">
                                                            {idx === messages.length - 1 && msg.role === 'assistant'
                                                                ? <StreamingText text={typeof msg.data.explanation === 'string' ? msg.data.explanation : JSON.stringify(msg.data.explanation ?? '', null, 2)} />
                                                                : (typeof msg.data.explanation === 'string' ? msg.data.explanation : JSON.stringify(msg.data.explanation ?? '', null, 2))}
                                                        </div>

                                                        {/* Multi-endpoint list: show each endpoint with its own Apply button */}
                                                        {msg.data.endpoints && msg.data.endpoints.length > 1 ? (
                                                            <div className="space-y-2 mt-1">
                                                                {msg.data.endpoints.map((ep, epIdx) => (
                                                                    <div key={epIdx} className="bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 p-2">
                                                                        <div className="flex items-center gap-1.5 text-[10px] mb-1">
                                                                            <span className={`font-bold px-1 py-0.5 rounded ${
                                                                                ep.method === 'GET' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30'
                                                                                : ep.method === 'POST' ? 'text-amber-600 bg-amber-50 dark:bg-amber-900/30'
                                                                                : ep.method === 'PUT' ? 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'
                                                                                : ep.method === 'DELETE' ? 'text-rose-600 bg-rose-50 dark:bg-rose-900/30'
                                                                                : 'text-slate-600 bg-slate-50 dark:bg-slate-800'
                                                                            }`}>{ep.method}</span>
                                                                            <span className="text-slate-500 dark:text-slate-400 font-mono break-all flex-1">{ep.url}</span>
                                                                        </div>
                                                                        {ep.explanation && (
                                                                            <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-1.5">{ep.explanation}</p>
                                                                        )}
                                                                        <button
                                                                            onClick={() => {
                                                                                createRequestFromAI({
                                                                                    method: ep.method || 'GET',
                                                                                    url: ep.url || '',
                                                                                    body: ep.suggested_body ? JSON.stringify(ep.suggested_body, null, 2) : null,
                                                                                    name: `AI: ${ep.method} ${(ep.url || '').split('/').pop() || 'Request'}`
                                                                                });
                                                                            }}
                                                                            className="w-full bg-corporate-600 hover:bg-corporate-700 text-white text-[10px] font-bold py-1 rounded transition-colors"
                                                                        >
                                                                            Apply
                                                                        </button>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <>
                                                                {msg.data.extracted_url && (
                                                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mb-2 font-mono break-all">
                                                                        {msg.data.extracted_url}
                                                                    </div>
                                                                )}
                                                                {msg.data.suggested_body && (
                                                                    <div className="mt-1">
                                                                        <JsonViewer data={msg.data.suggested_body} maxHeight="120px" showLineNumbers={false} />
                                                                    </div>
                                                                )}
                                                                <div className="mt-2 flex gap-2">
                                                                    <button
                                                                        onClick={() => handleApplyAndRun(idx, true)}
                                                                        disabled={executing || !msg.data.extracted_url}
                                                                        className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white text-[10px] font-bold py-1.5 rounded flex items-center justify-center gap-1 transition-colors"
                                                                    >
                                                                        {executing ? <Activity size={10} className="animate-spin" /> : <Play size={10} className="fill-current" />}
                                                                        <span>Run</span>
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleApplyAndRun(idx, false)}
                                                                        className="flex-1 bg-corporate-600 hover:bg-corporate-700 text-white text-[10px] font-bold py-1.5 rounded transition-colors"
                                                                    >
                                                                        Apply
                                                                    </button>
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                {msg.executionResult && (
                                                    <div className={`mt-2 rounded-lg p-2 border text-[10px] ${msg.executionResult.success ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800'}`}>
                                                        <div className="font-bold flex justify-between mb-1">
                                                            <span className={msg.executionResult.success ? 'text-green-600' : 'text-red-600'}>
                                                                {msg.executionResult.success ? 'Success' : 'Failed'}
                                                            </span>
                                                            <span className={`font-mono ${msg.executionResult.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}`}>
                                                                {msg.executionResult.status} {msg.executionResult.statusText}
                                                            </span>
                                                        </div>
                                                        <div className="mt-1">
                                                            {msg.executionResult.data ? (
                                                                <JsonViewer
                                                                    data={msg.executionResult.data}
                                                                    language={typeof msg.executionResult.data === 'object' ? 'json' : 'text'}
                                                                    maxHeight="120px"
                                                                    showLineNumbers={false}
                                                                />
                                                            ) : (
                                                                <div className="text-[10px] font-mono text-slate-400 dark:text-slate-500 p-1.5">
                                                                    {msg.executionResult.success ? 'Empty response' : 'Check URL and API'}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {msg.role === 'error' && (
                                        <div className="flex gap-2 items-start">
                                            <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0 mt-0.5">
                                                <Sparkles size={10} className="text-red-500" />
                                            </div>
                                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2 text-xs text-red-700 dark:text-red-400 max-w-full break-words whitespace-pre-wrap">
                                                {typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content, null, 2)}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}

                            {loading && (
                                <div className="flex gap-2 items-start mb-3">
                                    <div className="w-5 h-5 rounded-full bg-corporate-100 dark:bg-corporate-900/30 flex items-center justify-center shrink-0 mt-0.5">
                                        <Sparkles size={10} className="text-corporate-600 dark:text-corporate-400" />
                                    </div>
                                    <div className="bg-corporate-50 dark:bg-corporate-900/30 border border-corporate-100 dark:border-corporate-800 rounded-lg px-3 py-2 text-xs text-corporate-600 dark:text-corporate-400 flex items-center gap-2">
                                        <Activity size={12} className="animate-spin" />
                                        <span>Thinking...</span>
                                    </div>
                                </div>
                            )}

                            {messages.length === 0 && (
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setPrompt("Test GET https://jsonplaceholder.typicode.com/users/1")}
                                        className="text-xs border border-slate-200 dark:border-slate-700 px-2 py-1.5 rounded-md hover:border-emerald-400 hover:text-emerald-700 bg-white dark:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
                                    >
                                        Get User
                                    </button>
                                    <button
                                        onClick={() => setPrompt("Create a POST payload for https://jsonplaceholder.typicode.com/posts with title and body")}
                                        className="text-xs border border-slate-200 dark:border-slate-700 px-2 py-1.5 rounded-md hover:border-amber-400 hover:text-amber-700 bg-white dark:bg-slate-800 transition-colors text-slate-600 dark:text-slate-400"
                                    >
                                        Create Post
                                    </button>
                                </div>
                            )}

                            <div ref={chatEndRef} />
                        </div>
                    </div>

                    {/* Chat Input */}
                    <div className="p-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                        {messages.length > 0 && (
                            <div className="flex justify-end mb-2">
                                <button
                                    onClick={clearCollectionChat}
                                    className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-500 transition-colors flex items-center gap-1"
                                >
                                    <Trash2 size={10} /> Clear chat
                                </button>
                            </div>
                        )}
                        {/* Spec / Free Chat toggle */}
                        <div className="flex items-center gap-2 mb-2">
                            <button
                                onClick={() => setUseSpecContext(v => !v)}
                                className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${useSpecContext
                                    ? 'bg-blue-50 border-blue-300 text-blue-700 dark:bg-blue-900/30 dark:border-blue-600 dark:text-blue-300'
                                    : 'bg-gray-100 border-gray-300 text-gray-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400'
                                    }`}
                                title={useSpecContext
                                    ? 'Spec mode: AI uses loaded spec + URL detection. Click for free chat.'
                                    : 'Free chat: no spec, no URL routing. Click to re-enable spec.'}
                            >
                                {useSpecContext ? <FileCode size={11} /> : <MessageSquare size={11} />}
                                {useSpecContext ? 'Using Spec' : 'Free Chat'}
                            </button>
                            {useSpecContext && !openApiSpec && (
                                <span className="text-[10px] text-amber-500 dark:text-amber-400">No spec loaded</span>
                            )}
                        </div>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleExecute())}
                            className="w-full text-sm p-3 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-corporate-500 focus:border-transparent outline-none resize-none bg-white dark:bg-slate-900 dark:text-slate-200 shadow-sm"
                            rows={3}
                            placeholder={messages.length > 0 ? "Follow up... e.g. 'Now add pagination'" : "What API should I test?"}
                        />
                        <button
                            onClick={handleExecute}
                            disabled={loading || !prompt.trim()}
                            className="mt-2 w-full bg-slate-900 hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:bg-slate-400 text-white text-xs font-semibold py-2 rounded-md transition-colors flex items-center justify-center gap-2"
                        >
                            {loading ? <Activity size={12} className="animate-spin" /> : <ArrowRight size={12} />}
                            <span>{loading ? 'AI is thinking...' : messages.length > 0 ? 'Send Follow-up' : 'Ask AI'}</span>
                        </button>
                    </div>
                </>
            )}

            {/* ======================== SPEC TAB ======================== */}
            {activeTab === 'spec' && (
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <FileText size={12} />
                            OpenAPI Spec
                        </div>
                        {openApiSpec && (
                            <span className="text-[10px] bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800 px-2 py-0.5 rounded-full">Loaded</span>
                        )}
                    </div>

                    {/* Spec summary if loaded */}
                    {openApiSpec && (() => {
                        try {
                            let parsed;
                            try { parsed = JSON.parse(openApiSpec); } catch { parsed = yaml.load(openApiSpec); }
                            if (!parsed || typeof parsed !== 'object') return null;
                            const pathCount = Object.keys(parsed.paths || {}).length;
                            const title = parsed.info?.title || 'Unknown';
                            const baseUrl = parsed.servers?.[0]?.url || '';
                            return (
                                <div className="mb-3 p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{title}</div>
                                    {baseUrl && <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">{baseUrl}</div>}
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">{pathCount} paths found</div>
                                </div>
                            );
                        } catch { return null; }
                    })()}

                    {/* Base URL override */}
                    <div className="mb-2">
                        <label className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">
                            Base URL
                        </label>
                        <div className="flex gap-1.5">
                            <input
                                type="text"
                                value={localBaseUrl}
                                onChange={(e) => { setLocalBaseUrl(e.target.value); setCollectionBaseUrl(e.target.value); }}
                                className="flex-1 text-[11px] px-2.5 py-1.5 border border-slate-200 dark:border-slate-600 rounded-md font-mono bg-white dark:bg-slate-900 dark:text-slate-200 outline-none focus:ring-2 focus:ring-corporate-500"
                                placeholder="https://api.example.com"
                            />
                            <button
                                onClick={handleFetchSpec}
                                disabled={fetchingSpec || !localBaseUrl.trim()}
                                className="px-2.5 py-1.5 text-[10px] font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-md flex items-center gap-1 transition-colors shrink-0"
                                title="Auto-detect and fetch OpenAPI spec from this URL"
                            >
                                {fetchingSpec ? <Activity size={10} className="animate-spin" /> : <Download size={10} />}
                                {fetchingSpec ? 'Fetching...' : 'Fetch Spec'}
                            </button>
                        </div>
                        <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">Enter the API base URL. "Fetch Spec" auto-discovers the OpenAPI/Swagger spec.</p>
                    </div>

                    <textarea
                        value={localSpec}
                        onChange={(e) => {
                            const val = e.target.value;
                            setLocalSpec(val);
                            setImportResult(null);
                            // Auto-detect base URL from spec (JSON or YAML)
                            try {
                                let parsed;
                                try { parsed = JSON.parse(val); } catch { parsed = yaml.load(val); }
                                const specBaseUrl = parsed?.servers?.[0]?.url || '';
                                if (specBaseUrl) {
                                    setLocalBaseUrl(specBaseUrl);
                                    setCollectionBaseUrl(specBaseUrl);
                                }
                            } catch { /* not valid spec yet, ignore */ }
                        }}
                        onBlur={() => { if (localSpec.trim()) setCollectionOpenApiSpec(localSpec); }}
                        className="w-full text-[10px] p-3 border border-slate-200 dark:border-slate-600 rounded-lg font-mono bg-slate-50 dark:bg-slate-900 dark:text-slate-200 resize-none outline-none focus:ring-2 focus:ring-corporate-500"
                        rows={8}
                        placeholder="Paste OpenAPI/Swagger spec (JSON or YAML)..."
                    />

                    <div className="flex gap-2 mt-2">
                        <button
                            onClick={() => {
                                if (!localSpec.trim()) return;
                                setCollectionOpenApiSpec(localSpec);
                                setImportResult({ success: true, saved: true });
                            }}
                            disabled={!localSpec.trim()}
                            className="flex-1 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white text-[10px] font-bold py-2 rounded flex items-center justify-center gap-1 transition-colors"
                        >
                            Save as Context
                        </button>
                        <button
                            onClick={handleImportSpec}
                            disabled={!localSpec.trim()}
                            className="flex-1 bg-corporate-600 hover:bg-corporate-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white text-[10px] font-bold py-2 rounded flex items-center justify-center gap-1 transition-colors"
                        >
                            <Download size={10} />
                            Import Endpoints
                        </button>
                    </div>

                    {importResult && (
                        <div className={`mt-2 text-[10px] px-2 py-1.5 rounded ${importResult.success
                            ? 'bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                            : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800'
                            }`}>
                            {importResult.fetched
                                ? `Spec auto-fetched from ${importResult.fetched} and saved as AI context`
                                : importResult.saved
                                ? 'Spec saved as AI context for this collection'
                                : importResult.success
                                    ? `Imported ${importResult.count} endpoints into "${importResult.title}"`
                                    : importResult.error}
                        </div>
                    )}

                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 leading-4">
                        The spec is used as context for the AI chat in this collection. You can also import all endpoints as requests.
                    </p>
                </div>
            )}

            {/* ======================== TESTS TAB ======================== */}
            {activeTab === 'tests' && (
                <div className="flex-1 overflow-y-auto p-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                            <FlaskConical size={12} />
                            Test Suites
                        </div>
                        <button
                            onClick={handleGenerateTests}
                            disabled={generating}
                            className="text-[10px] font-bold bg-corporate-600 hover:bg-corporate-700 disabled:bg-corporate-300 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                        >
                            {generating ? <Activity size={10} className="animate-spin" /> : <Sparkles size={10} />}
                            {generating ? 'Generating...' : 'Generate with AI'}
                        </button>
                    </div>

                    {/* Test prompt input */}
                    <textarea
                        value={testPrompt}
                        onChange={(e) => setTestPrompt(e.target.value)}
                        className="w-full text-[11px] p-2.5 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-slate-200 resize-none outline-none focus:ring-2 focus:ring-corporate-500 mb-3"
                        rows={3}
                        placeholder="Describe what tests you want... e.g. 'Test auth endpoints with invalid tokens, test rate limiting, check required fields on POST endpoints'"
                    />

                    {testSuites.length === 0 && !generating && (
                        <div className="text-center py-6">
                            <FlaskConical size={28} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" strokeWidth={1} />
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">No test suites yet</p>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1 px-4">
                                Describe what to test above, or leave empty for a comprehensive auto-generated suite.
                            </p>
                        </div>
                    )}

                    {testSuites.map((suite, sIdx) => (
                        <div key={suite.id} className="animate-slide-up" style={{ animationDelay: `${sIdx * 100}ms`, animationFillMode: 'both' }}>
                            <TestSuiteCard
                                suite={suite}
                                colId={activeCollectionId}
                                onDelete={() => deleteTestSuite(activeCollectionId, suite.id)}
                                onRun={() => openRunnerForTestSuite(activeCollectionId, suite)}
                                onImport={() => {
                                    const importTests = useWorkspaceStore.getState().importTestsToCollection;
                                    const result = importTests(activeCollectionId, suite.tests || []);
                                    alert(`Imported ${result.imported} requests${result.skipped ? ` (${result.skipped} duplicates skipped)` : ''}`);
                                }}
                                categoryColors={CATEGORY_COLORS}
                                methodColors={METHOD_COLORS}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// Extracted component for test suite cards
const TestSuiteCard = ({ suite, colId, onDelete, onRun, onImport, categoryColors, methodColors }) => {
    const [expanded, setExpanded] = useState(false);
    const tests = suite.tests || [];
    const lrs = suite.lastRunSummary;

    return (
        <div className="mb-3 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div
                className="flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? <ChevronDown size={12} className="text-slate-400 dark:text-slate-500" /> : <ChevronUp size={12} className="text-slate-400 dark:text-slate-500 rotate-180" />}
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{suite.test_suite_name || 'Test Suite'}</div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 dark:text-slate-500">
                        <span>{tests.length} tests</span>
                        {lrs && (
                            <>
                                <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5">
                                    <CheckCircle size={9} /> {lrs.passed}
                                </span>
                                {lrs.failed > 0 && (
                                    <span className="text-red-500 dark:text-red-400 flex items-center gap-0.5">
                                        <XCircle size={9} /> {lrs.failed}
                                    </span>
                                )}
                                <span className={`font-semibold ${lrs.passRate >= 80 ? 'text-green-600 dark:text-green-400' : lrs.passRate >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-red-500 dark:text-red-400'}`}>
                                    {lrs.passRate}%
                                </span>
                            </>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1.5">
                    <button
                        onClick={(e) => { e.stopPropagation(); onImport(); }}
                        className="p-1 text-corporate-600 hover:bg-corporate-50 dark:hover:bg-corporate-900/20 rounded transition-colors"
                        title="Import all tests as collection requests"
                    >
                        <FolderInput size={12} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onRun(); }}
                        className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors"
                        title="Run this suite"
                    >
                        <Play size={12} className="fill-current" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); onDelete(); }}
                        className="p-1 text-slate-400 dark:text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                        title="Delete suite"
                    >
                        <Trash2 size={12} />
                    </button>
                </div>
            </div>

            {expanded && (
                <div className="border-t border-slate-200 dark:border-slate-700">
                    {tests.map((test, idx) => (
                        <TestItemRow key={idx} test={test} colId={colId} methodColors={methodColors} categoryColors={categoryColors} />
                    ))}
                </div>
            )}
        </div>
    );
};

// Individual test row — click to expand and see URL, headers, body
const TestItemRow = ({ test, colId, methodColors, categoryColors }) => {
    const [open, setOpen] = useState(false);

    const bodyStr = test.payload || test.body;
    const bodyFormatted = (() => {
        if (!bodyStr) return null;
        if (typeof bodyStr === 'string') {
            try { return JSON.stringify(JSON.parse(bodyStr), null, 2); } catch { return bodyStr; }
        }
        return JSON.stringify(bodyStr, null, 2);
    })();

    const headerEntries = (() => {
        try {
            if (!test.headers) return [];
            const h = typeof test.headers === 'string' ? JSON.parse(test.headers) : test.headers;
            return Object.entries(h);
        } catch { return []; }
    })();

    return (
        <div className="border-b border-slate-100 dark:border-slate-800 last:border-0">
            <div
                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                onClick={() => setOpen(!open)}
            >
                <ChevronDown size={10} className={`text-slate-400 dark:text-slate-500 transition-transform ${open ? '' : '-rotate-90'}`} />
                <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${methodColors[test.method] || 'text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-800'}`}>
                    {test.method}
                </span>
                <span className="text-[11px] text-slate-700 dark:text-slate-300 flex-1 truncate">{test.name}</span>
                <span className={`text-[8px] px-1.5 py-0.5 rounded border font-medium ${categoryColors[test.category] || 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'}`}>
                    {(test.category || 'test').replace('_', ' ')}
                </span>
            </div>

            {open && (
                <div className="px-3 pb-2 ml-5 space-y-1.5">
                    {test.description && (
                        <p className="text-[10px] text-slate-400 dark:text-slate-500">{test.description}</p>
                    )}

                    {/* URL */}
                    {(test.endpoint || test.url) && (
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">URL</span>
                            <div className="text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded px-2 py-1 break-all border border-slate-200 dark:border-slate-700">
                                {test.endpoint || test.url}
                            </div>
                        </div>
                    )}

                    {/* Headers */}
                    {headerEntries.length > 0 && (
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Headers</span>
                            <div className="text-[10px] font-mono bg-slate-50 dark:bg-slate-800 rounded px-2 py-1 border border-slate-200 dark:border-slate-700">
                                {headerEntries.map(([k, v], i) => (
                                    <div key={i} className="text-slate-600 dark:text-slate-300">
                                        <span className="text-slate-500 dark:text-slate-400">{k}:</span> {v}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Body */}
                    {bodyFormatted && (
                        <div>
                            <span className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase">Body</span>
                            <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-800 rounded px-2 py-1 border border-slate-200 dark:border-slate-700 max-h-24 overflow-auto whitespace-pre-wrap">
                                {bodyFormatted}
                            </pre>
                        </div>
                    )}

                    {/* Expected Status + Import */}
                    <div className="flex items-center justify-between">
                        <div className="text-[10px] text-slate-400 dark:text-slate-500">
                            Expected: <span className="font-mono font-bold text-slate-500 dark:text-slate-400">{test.expected_status}</span>
                        </div>
                        {colId && (
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const importTests = useWorkspaceStore.getState().importTestsToCollection;
                                    const result = importTests(colId, [test]);
                                    alert(result.imported ? 'Imported as request' : 'Already exists in collection');
                                }}
                                className="text-[9px] text-corporate-600 dark:text-corporate-400 hover:underline flex items-center gap-0.5"
                            >
                                <FolderInput size={9} /> Import as Request
                            </button>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
