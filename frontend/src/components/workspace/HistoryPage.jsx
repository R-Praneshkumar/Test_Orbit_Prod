import React, { useState, useMemo } from 'react';
import {
    Clock, Search, Filter, Trash2, ChevronDown, ChevronRight,
    CheckCircle, XCircle, ArrowLeft,
} from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

const METHOD_COLORS = {
    GET: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30',
    POST: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30',
    PUT: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30',
    DELETE: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/30',
    PATCH: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/30',
};

const STATUS_GROUPS = [
    { label: 'All', value: '' },
    { label: '2xx', value: '2' },
    { label: '3xx', value: '3' },
    { label: '4xx', value: '4' },
    { label: '5xx', value: '5' },
    { label: 'Error', value: '0' },
];

const METHODS = ['', 'GET', 'POST', 'PUT', 'DELETE', 'PATCH'];

function formatTimestamp(ts) {
    const d = new Date(ts);
    const now = new Date();
    const diff = now - d;
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (d.toDateString() === new Date(now - 86400000).toDateString()) return 'Yesterday';
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function HistoryDetail({ entry, onClose }) {
    return (
        <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 px-4 py-3 animate-slide-up">
            <div className="flex items-center justify-between mb-2">
                <button
                    onClick={onClose}
                    className="flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
                    aria-label="Close detail"
                >
                    <ArrowLeft size={10} /> Back
                </button>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                    {new Date(entry.timestamp).toLocaleString()}
                </span>
            </div>

            <div className="space-y-2">
                <div>
                    <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Request</div>
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 break-all">
                        <span className={`font-bold ${METHOD_COLORS[entry.method]?.split(' ')[0] || 'text-slate-500'}`}>{entry.method}</span>{' '}
                        {entry.url}
                    </div>
                </div>

                <div className="flex gap-3 text-[10px]">
                    <div>
                        <span className="text-slate-400 dark:text-slate-500">Status: </span>
                        <span className={entry.success ? 'text-green-600 dark:text-green-400 font-bold' : 'text-red-600 dark:text-red-400 font-bold'}>
                            {entry.status} {entry.statusText || ''}
                        </span>
                    </div>
                    <div>
                        <span className="text-slate-400 dark:text-slate-500">Time: </span>
                        <span className="text-slate-700 dark:text-slate-300 font-mono">{entry.time}ms</span>
                    </div>
                </div>

                {entry.responseBody && (
                    <div>
                        <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-0.5">Response Body (preview)</div>
                        <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-2 max-h-40 overflow-auto whitespace-pre-wrap break-all">
                            {entry.responseBody}
                        </pre>
                    </div>
                )}
            </div>
        </div>
    );
}

const HistoryPage = () => {
    const requestHistory = useWorkspaceStore(state => state.requestHistory);
    const clearRequestHistory = useWorkspaceStore(state => state.clearRequestHistory);
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);

    const [search, setSearch] = useState('');
    const [methodFilter, setMethodFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [expandedId, setExpandedId] = useState(null);
    const [showFilters, setShowFilters] = useState(false);

    const filtered = useMemo(() => {
        let items = requestHistory || [];
        if (search) {
            const q = search.toLowerCase();
            items = items.filter(e =>
                (e.name || '').toLowerCase().includes(q) ||
                (e.url || '').toLowerCase().includes(q)
            );
        }
        if (methodFilter) {
            items = items.filter(e => e.method === methodFilter);
        }
        if (statusFilter) {
            if (statusFilter === '0') {
                items = items.filter(e => e.status === 0 || !e.status);
            } else {
                items = items.filter(e => String(e.status).startsWith(statusFilter));
            }
        }
        return items;
    }, [requestHistory, search, methodFilter, statusFilter]);

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
            <div className="max-w-4xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-corporate-100 dark:bg-corporate-900/30 flex items-center justify-center">
                            <Clock size={20} className="text-corporate-600 dark:text-corporate-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Request History</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {requestHistory.length} requests recorded
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setCurrentView('workspace')}
                            className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Back to Workspace
                        </button>
                        {requestHistory.length > 0 && (
                            <button
                                onClick={() => { if (window.confirm('Clear all request history?')) clearRequestHistory(); }}
                                className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 dark:text-red-400 bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                aria-label="Clear history"
                            >
                                <Trash2 size={12} /> Clear
                            </button>
                        )}
                    </div>
                </div>

                {/* Search + Filters */}
                <div className="mb-4 space-y-2">
                    <div className="flex gap-2">
                        <div className="flex-1 flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3">
                            <Search size={14} className="text-slate-400 shrink-0" />
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search by name or URL..."
                                className="flex-1 py-2 text-sm bg-transparent text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                            />
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border rounded-lg transition-colors ${showFilters
                                ? 'bg-corporate-50 dark:bg-corporate-900/20 border-corporate-200 dark:border-corporate-700 text-corporate-600 dark:text-corporate-400'
                                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                                }`}
                            aria-label="Toggle filters"
                        >
                            <Filter size={12} /> Filters
                            {(methodFilter || statusFilter) && (
                                <span className="w-1.5 h-1.5 rounded-full bg-corporate-500" />
                            )}
                        </button>
                    </div>

                    {showFilters && (
                        <div className="flex gap-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-4 py-3 animate-slide-up">
                            <div>
                                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Method</label>
                                <select
                                    value={methodFilter}
                                    onChange={e => setMethodFilter(e.target.value)}
                                    className="text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-slate-700 dark:text-slate-300 outline-none"
                                >
                                    {METHODS.map(m => (
                                        <option key={m} value={m}>{m || 'All'}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase block mb-1">Status</label>
                                <div className="flex gap-1">
                                    {STATUS_GROUPS.map(sg => (
                                        <button
                                            key={sg.value}
                                            onClick={() => setStatusFilter(statusFilter === sg.value ? '' : sg.value)}
                                            className={`px-2 py-0.5 text-[10px] font-semibold rounded transition-colors ${statusFilter === sg.value
                                                ? 'bg-corporate-600 text-white'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                                                }`}
                                        >
                                            {sg.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {(methodFilter || statusFilter) && (
                                <button
                                    onClick={() => { setMethodFilter(''); setStatusFilter(''); }}
                                    className="text-[10px] text-corporate-600 dark:text-corporate-400 hover:underline self-end mb-0.5"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {/* Results count */}
                {(search || methodFilter || statusFilter) && (
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mb-2">
                        Showing {filtered.length} of {requestHistory.length} requests
                    </div>
                )}

                {/* History List */}
                {filtered.length === 0 ? (
                    <div className="text-center py-16">
                        <Clock size={40} className="mx-auto text-slate-200 dark:text-slate-700 mb-3" />
                        <p className="text-sm text-slate-400 dark:text-slate-500">
                            {requestHistory.length === 0
                                ? 'No requests yet. Send a request to see it here.'
                                : 'No requests match your filters.'}
                        </p>
                    </div>
                ) : (
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-700">
                        {filtered.map(entry => (
                            <div key={entry.id}>
                                <button
                                    onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left"
                                >
                                    {/* Expand icon */}
                                    {expandedId === entry.id
                                        ? <ChevronDown size={12} className="text-slate-400 shrink-0" />
                                        : <ChevronRight size={12} className="text-slate-400 shrink-0" />
                                    }

                                    {/* Status icon */}
                                    {entry.success
                                        ? <CheckCircle size={14} className="text-green-500 shrink-0" />
                                        : <XCircle size={14} className="text-red-500 shrink-0" />
                                    }

                                    {/* Method badge */}
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${METHOD_COLORS[entry.method] || 'text-slate-500 bg-slate-50'}`}>
                                        {entry.method}
                                    </span>

                                    {/* Name */}
                                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate min-w-0 flex-1">
                                        {entry.name || entry.url}
                                    </span>

                                    {/* Status code */}
                                    <span className={`text-[10px] font-bold font-mono ${entry.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                        {entry.status || 'ERR'}
                                    </span>

                                    {/* Duration */}
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono w-14 text-right shrink-0">
                                        {entry.time}ms
                                    </span>

                                    {/* Timestamp */}
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 w-20 text-right shrink-0">
                                        {formatTimestamp(entry.timestamp)}
                                    </span>
                                </button>

                                {expandedId === entry.id && (
                                    <HistoryDetail
                                        entry={entry}
                                        onClose={() => setExpandedId(null)}
                                    />
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default HistoryPage;
