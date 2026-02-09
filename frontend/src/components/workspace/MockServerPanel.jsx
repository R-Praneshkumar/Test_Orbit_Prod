import React, { useState, useEffect } from 'react';
import { Trash2, RefreshCw, Server, Copy, Check, ExternalLink } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

export function MockServerPanel() {
    const [mocks, setMocks] = useState([]);
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(null);

    const fetchMocks = async () => {
        setLoading(true);
        try {
            const res = await fetch('http://localhost:8000/mock-server/list');
            if (res.ok) {
                const data = await res.json();
                // Convert dict to array of objects
                const mockList = Object.entries(data).map(([key, value]) => {
                    const [method, ...pathParts] = key.split(' ');
                    return {
                        method,
                        path: pathParts.join(' '),
                        response: value
                    };
                });
                setMocks(mockList);
            }
        } catch (err) {
            console.error("Failed to fetch mocks", err);
        } finally {
            setLoading(false);
        }
    };

    const clearMocks = async () => {
        if (!confirm("Are you sure you want to clear all active mocks?")) return;
        try {
            await fetch('http://localhost:8000/mock-server/clear', { method: 'DELETE' });
            fetchMocks();
        } catch (err) {
            console.error("Failed to clear mocks", err);
        }
    };

    useEffect(() => {
        fetchMocks();
        // Auto-refresh every 5 seconds to show new AI-generated mocks
        const interval = setInterval(fetchMocks, 5000);
        return () => clearInterval(interval);
    }, []);

    const copyToClipboard = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        setTimeout(() => setCopied(null), 2000);
    };

    return (
        <div className="flex-1 flex flex-col h-full bg-slate-50 dark:bg-slate-950 overflow-hidden">
            {/* Header */}
            <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-between px-6 shrink-0">
                <div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Server className="text-purple-500" size={24} />
                        AI Mock Server
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Send requests to <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-purple-600 dark:text-purple-400">/mock-server/*</code> and Gemini will invent the response.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={fetchMocks}
                        className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                        title="Refresh List"
                    >
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                    <button
                        onClick={clearMocks}
                        className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors text-sm font-medium"
                    >
                        <Trash2 size={16} />
                        Clear All Mocks
                    </button>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-auto p-6">
                {mocks.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center max-w-md mx-auto opacity-50">
                        <Server size={64} className="text-slate-300 dark:text-slate-600 mb-6" />
                        <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300">No Active Mocks</h3>
                        <p className="text-slate-500 dark:text-slate-400 mt-2">
                            To create a mock, simply send a request to the backend with the <span className="font-mono text-xs bg-slate-200 dark:bg-slate-700 px-1 py-0.5 rounded">/mock-server/</span> prefix.
                        </p>
                        <div className="mt-8 p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 w-full text-left">
                            <div className="text-xs font-mono text-slate-500 mb-2">Example:</div>
                            <code className="block text-sm text-purple-600 dark:text-purple-400 mb-2">
                                POST http://localhost:8000/mock-server/api/users
                            </code>
                            <code className="block text-sm text-purple-600 dark:text-purple-400">
                                GET http://localhost:8000/mock-server/api/products/123
                            </code>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {mocks.map((mock, idx) => (
                            <div key={idx} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow flex flex-col h-96">
                                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/50">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <span className={`px-2 py-1 rounded text-xs font-bold ${mock.method === 'GET' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                                                mock.method === 'POST' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                    mock.method === 'DELETE' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                                                        'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                                            }`}>
                                            {mock.method}
                                        </span>
                                        <span className="font-mono text-sm text-slate-600 dark:text-slate-300 truncate" title={mock.path}>
                                            /{mock.path}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => copyToClipboard(`http://localhost:8000/mock-server/${mock.path}`, `url-${idx}`)}
                                            className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded transition-colors"
                                            title="Copy URL"
                                        >
                                            {copied === `url-${idx}` ? <Check size={14} className="text-green-500" /> : <ExternalLink size={14} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-auto p-0 bg-slate-50 dark:bg-slate-950 font-mono text-xs relative group">
                                    <button
                                        onClick={() => copyToClipboard(JSON.stringify(mock.response, null, 2), `body-${idx}`)}
                                        className="absolute top-2 right-2 p-1.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur rounded border border-slate-200 dark:border-slate-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        {copied === `body-${idx}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} className="text-slate-500" />}
                                    </button>
                                    <pre className="p-4 text-slate-700 dark:text-slate-300">
                                        {JSON.stringify(mock.response, null, 2)}
                                    </pre>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
