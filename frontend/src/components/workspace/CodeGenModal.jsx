import React, { useState } from 'react';
import { X, Code2, Loader2, Sparkles } from 'lucide-react';
import { CodeViewer } from './JsonViewer';

const API_BASE = "http://localhost:8000/api/v1";

const LANGUAGES = [
    {
        id: 'python', label: 'Python',
        variants: [
            { id: 'requests', label: 'requests' },
            { id: 'httpx', label: 'httpx' },
            { id: 'aiohttp', label: 'aiohttp' },
        ]
    },
    {
        id: 'javascript', label: 'JavaScript',
        variants: [
            { id: 'fetch', label: 'fetch' },
            { id: 'axios', label: 'axios' },
            { id: 'node-fetch', label: 'node-fetch' },
        ]
    },
    { id: 'go', label: 'Go', variants: [] },
    { id: 'java', label: 'Java', variants: [] },
    { id: 'curl', label: 'cURL', variants: [] },
];

const LANG_TO_HIGHLIGHT = {
    python: 'python',
    javascript: 'javascript',
    go: 'go',
    java: 'java',
    curl: 'bash',
};

const LANG_TO_FILENAME = {
    python: 'api_client.py',
    javascript: 'apiClient.js',
    go: 'api_client.go',
    java: 'ApiClient.java',
    curl: 'request.sh',
};

export const CodeGenModal = ({ request, onClose }) => {
    const [selectedLang, setSelectedLang] = useState('python');
    const [selectedVariant, setSelectedVariant] = useState('requests');
    const [includeTests, setIncludeTests] = useState(false);
    const [generatedCode, setGeneratedCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const currentLang = LANGUAGES.find(l => l.id === selectedLang);
    const variants = currentLang?.variants || [];

    const handleLangChange = (langId) => {
        setSelectedLang(langId);
        const lang = LANGUAGES.find(l => l.id === langId);
        setSelectedVariant(lang?.variants?.[0]?.id || '');
        setGeneratedCode('');
        setError(null);
    };

    const handleGenerate = async () => {
        setLoading(true);
        setError(null);
        setGeneratedCode('');

        // Build headers object from request
        const headers = {};
        (request.headers || []).forEach(h => {
            if (h.enabled !== false && h.key) {
                headers[h.key] = h.value;
            }
        });

        // Add auth headers
        if (request.authType === 'bearer' && request.authToken) {
            headers['Authorization'] = `Bearer ${request.authToken}`;
        } else if (request.authType === 'basic' && request.authUsername) {
            headers['Authorization'] = `Basic <base64(${request.authUsername}:${request.authPassword || ''})>`;
        } else if (request.authType === 'apikey' && request.authKeyValue) {
            headers[request.authKeyName || 'X-API-Key'] = request.authKeyValue;
        }

        const payload = {
            method: request.method || 'GET',
            url: request.url || '',
            headers: Object.keys(headers).length > 0 ? headers : null,
            body: request.body?.content || null,
            language: selectedLang,
            variant: selectedVariant || null,
            include_tests: includeTests,
        };

        try {
            const res = await fetch(`${API_BASE}/codegen`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.detail || `Server error ${res.status}`);
            }

            const data = await res.json();
            setGeneratedCode(data.code || '// No code generated');
        } catch (err) {
            setError(err.message || 'Failed to generate code');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
            <div
                className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-[680px] max-h-[85vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Code2 size={16} className="text-corporate-600 dark:text-corporate-400" />
                        Generate Code
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400">
                        <X size={16} />
                    </button>
                </div>

                {/* Language Tabs */}
                <div className="px-5 pt-4">
                    <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-0.5 gap-0.5">
                        {LANGUAGES.map(lang => (
                            <button
                                key={lang.id}
                                onClick={() => handleLangChange(lang.id)}
                                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                                    selectedLang === lang.id
                                        ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
                                        : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                                }`}
                            >
                                {lang.label}
                            </button>
                        ))}
                    </div>

                    {/* Variant sub-options */}
                    {variants.length > 0 && (
                        <div className="flex items-center gap-2 mt-3">
                            <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">Library:</span>
                            {variants.map(v => (
                                <button
                                    key={v.id}
                                    onClick={() => { setSelectedVariant(v.id); setGeneratedCode(''); }}
                                    className={`text-[11px] px-2.5 py-1 rounded-full font-medium border transition-all ${
                                        selectedVariant === v.id
                                            ? 'bg-corporate-50 dark:bg-corporate-900/30 text-corporate-700 dark:text-corporate-400 border-corporate-300 dark:border-corporate-600'
                                            : 'text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                                    }`}
                                >
                                    {v.label}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Options */}
                    <div className="flex items-center justify-between mt-4">
                        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={includeTests}
                                onChange={(e) => setIncludeTests(e.target.checked)}
                                className="rounded border-slate-300 dark:border-slate-600 text-corporate-600 focus:ring-corporate-500"
                            />
                            Include test assertions
                        </label>
                        <button
                            onClick={handleGenerate}
                            disabled={loading || !request.url}
                            className="flex items-center gap-2 px-4 py-2 bg-corporate-600 hover:bg-corporate-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white text-xs font-bold rounded-lg shadow-md shadow-corporate-200 dark:shadow-none transition-all active:scale-95"
                        >
                            {loading ? (
                                <><Loader2 size={14} className="animate-spin" /> Generating...</>
                            ) : (
                                <><Sparkles size={14} /> Generate</>
                            )}
                        </button>
                    </div>

                    {/* Request summary */}
                    <div className="mt-3 p-2.5 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 text-xs">
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] ${
                                request.method === 'GET' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                request.method === 'POST' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                request.method === 'PUT' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' :
                                request.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                            }`}>
                                {request.method || 'GET'}
                            </span>
                            <span className="text-slate-600 dark:text-slate-300 font-mono truncate">{request.url || 'No URL set'}</span>
                        </div>
                    </div>
                </div>

                {/* Generated code area */}
                <div className="flex-1 overflow-auto px-5 py-4">
                    {error && (
                        <div className="p-3 mb-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-xs text-red-700 dark:text-red-300">
                            {error}
                        </div>
                    )}

                    {loading && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-500">
                            <Loader2 size={32} className="animate-spin mb-3 text-corporate-500" />
                            <span className="text-sm font-medium">Generating {currentLang?.label} code...</span>
                            <span className="text-xs mt-1">Powered by Gemini AI</span>
                        </div>
                    )}

                    {!loading && !generatedCode && !error && (
                        <div className="flex flex-col items-center justify-center py-12 text-slate-300 dark:text-slate-600">
                            <Code2 size={40} strokeWidth={1} className="mb-3" />
                            <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Select a language and click Generate</span>
                            <span className="text-xs mt-1 text-slate-400 dark:text-slate-500">AI will create production-ready code for your request</span>
                        </div>
                    )}

                    {!loading && generatedCode && (
                        <CodeViewer
                            code={generatedCode}
                            language={LANG_TO_HIGHLIGHT[selectedLang] || 'text'}
                            filename={LANG_TO_FILENAME[selectedLang] || 'code.txt'}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};
