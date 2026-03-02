import React, { useState, useEffect } from 'react';
import { Folder, FlaskConical, CheckCircle, XCircle, Plus, Terminal, Upload, Clock, ArrowRight, FileText, Users, Shield, Pencil, Sparkles, Code, FlaskRound, MessageSquare, Server, Check } from 'lucide-react';
import { useWorkspaceStore, flattenItems } from '../../store/workspaceStore';
import { API_BASE, authFetch } from '../../config';
import { CurlImportModal } from './CurlImportModal';
import { ImportCollectionModal } from './ImportCollectionModal';

const USAGE_COLORS = {
    purple: { bar: 'bg-purple-500', track: 'bg-purple-100 dark:bg-purple-900/30', warn: 'text-amber-600 dark:text-amber-400', full: 'text-red-600 dark:text-red-400' },
    blue: { bar: 'bg-blue-500', track: 'bg-blue-100 dark:bg-blue-900/30', warn: 'text-amber-600 dark:text-amber-400', full: 'text-red-600 dark:text-red-400' },
    emerald: { bar: 'bg-emerald-500', track: 'bg-emerald-100 dark:bg-emerald-900/30', warn: 'text-amber-600 dark:text-amber-400', full: 'text-red-600 dark:text-red-400' },
};

function UsageBar({ icon, label, used, limit, color }) {
    const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0;
    const c = USAGE_COLORS[color] || USAGE_COLORS.purple;
    const isWarn = pct >= 80 && pct < 100;
    const isFull = pct >= 100;

    return (
        <div>
            <div className="flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                    {icon} {label}
                </span>
                <span className={`text-xs font-semibold ${isFull ? c.full : isWarn ? c.warn : 'text-slate-500 dark:text-slate-400'}`}>
                    {used}/{limit}
                </span>
            </div>
            <div className={`h-1.5 rounded-full ${c.track}`}>
                <div
                    className={`h-full rounded-full transition-all duration-500 ${isFull ? 'bg-red-500' : isWarn ? 'bg-amber-500' : c.bar}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}

const CAPABILITIES = [
    {
        icon: MessageSquare,
        title: 'AI Chat',
        desc: 'Ask AI anything about your API \u2014 debug errors, explain responses, suggest improvements.',
        color: 'text-purple-500',
        bg: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800',
    },
    {
        icon: FlaskConical,
        title: 'Test Generation',
        desc: 'Generate 20+ test assertions in seconds from any endpoint. Covers edge cases automatically.',
        color: 'text-blue-500',
        bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    },
    {
        icon: Code,
        title: 'Code Generation',
        desc: 'Export production-ready code in 11 languages \u2014 Python, JavaScript, Go, Rust, and more.',
        color: 'text-emerald-500',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800',
    },
    {
        icon: Server,
        title: 'Mock Server',
        desc: 'Spin up realistic fake APIs instantly. AI generates responses matching your schema.',
        color: 'text-amber-500',
        bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
    },
];

function HeroBanner({ onCreateCollection, onLoadDemo }) {
    return (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 p-8 sm:p-10 mb-8">
            {/* Decorative elements */}
            <div className="absolute top-10 -right-10 w-56 h-56 bg-purple-500/20 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 left-20 w-40 h-40 bg-indigo-400/20 rounded-full blur-3xl" />
            <div className="absolute top-1/2 right-1/3 w-24 h-24 bg-white/5 rounded-full blur-2xl" />

            {/* Orbit icon */}
            <div className="relative z-10">
                <div className="w-12 h-12 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20 mb-5">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="3" fill="white" />
                        <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6" />
                        <circle cx="20" cy="12" r="2" fill="white" />
                    </svg>
                </div>

                <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight mb-3">
                    Test APIs smarter, not harder.
                </h1>
                <p className="text-purple-200 text-sm sm:text-base max-w-lg leading-relaxed mb-6">
                    AI-powered testing, mock servers, and code generation &mdash; all in one workspace.
                    Powered by Google Gemini 2.0 Flash.
                </p>

                <div className="flex flex-wrap gap-3">
                    <button
                        onClick={onCreateCollection}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white text-purple-700 text-sm font-semibold rounded-lg shadow-lg shadow-purple-900/30 hover:bg-purple-50 transition-all active:scale-95"
                    >
                        <Plus size={16} />
                        Create Collection
                    </button>
                    <button
                        onClick={onLoadDemo}
                        className="flex items-center gap-2 px-5 py-2.5 bg-white/15 backdrop-blur-sm text-white text-sm font-medium rounded-lg border border-white/25 hover:bg-white/25 transition-all active:scale-95"
                    >
                        <Sparkles size={16} />
                        Explore Demo API
                    </button>
                </div>
            </div>
        </div>
    );
}

function CapabilityCards() {
    return (
        <div className="mb-8">
            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">What you can do</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {CAPABILITIES.map(cap => (
                    <div
                        key={cap.title}
                        className={`rounded-xl border p-4 ${cap.bg} transition-all hover:shadow-md hover:-translate-y-0.5 duration-200`}
                    >
                        <cap.icon size={20} className={`${cap.color} mb-2.5`} />
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">{cap.title}</h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{cap.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}

function FreePlanSummary({ onViewPricing }) {
    return (
        <div className="mb-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5">
            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Free plan includes</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
                {[
                    'Unlimited collections & requests',
                    '25 AI calls per day',
                    '5 test generations per day',
                    '5 code generations per day',
                    'WebSocket testing',
                    'All body types (JSON, Form, File)',
                    'Sequential test runner',
                    '5 mock endpoints',
                ].map(item => (
                    <div key={item} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                        <Check size={12} className="text-emerald-500 shrink-0" />
                        {item}
                    </div>
                ))}
            </div>
            <button
                onClick={onViewPricing}
                className="flex items-center gap-1.5 text-xs font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
            >
                Need more? See pricing <ArrowRight size={12} />
            </button>
        </div>
    );
}

export const Dashboard = () => {
    const collections = useWorkspaceStore(state => state.collections);
    const setActiveCollection = useWorkspaceStore(state => state.setActiveCollection);
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);
    const addCollection = useWorkspaceStore(state => state.addCollection);
    const loadDemoCollection = useWorkspaceStore(state => state.loadDemoCollection);
    const user = useWorkspaceStore(state => state.user);
    const profile = useWorkspaceStore(state => state.profile);
    const getCollectionRole = useWorkspaceStore(state => state.getCollectionRole);
    const subscription = useWorkspaceStore(state => state.subscription);
    const [showCurlImport, setShowCurlImport] = useState(false);
    const [showCollectionImport, setShowCollectionImport] = useState(false);
    const [showNewCollInput, setShowNewCollInput] = useState(false);
    const [newCollName, setNewCollName] = useState('');
    const [usage, setUsage] = useState(null);

    useEffect(() => {
        let cancelled = false;
        authFetch(`${API_BASE}/usage/today`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (!cancelled && data) setUsage(data); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    const handleOpenCollection = (colId) => {
        setActiveCollection(colId);
        setCurrentView('workspace');
    };

    const handleNewCollection = () => {
        setShowNewCollInput(true);
        setNewCollName('');
    };

    const handleNewCollSubmit = () => {
        if (newCollName.trim()) {
            addCollection(newCollName.trim());
        }
        setShowNewCollInput(false);
        setNewCollName('');
    };

    const handleLoadDemo = () => {
        if (loadDemoCollection) {
            loadDemoCollection();
            setCurrentView('workspace');
        }
    };

    const getLastRunStats = (col) => {
        const runs = col.runHistory || [];
        if (runs.length === 0) return null;
        return runs[0];
    };

    const getAllRecentRuns = () => {
        const allRuns = [];
        collections.forEach(col => {
            (col.runHistory || []).forEach(run => {
                allRuns.push({ ...run, collectionName: col.name, collectionId: col.id });
            });
        });
        return allRuns.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 5);
    };

    const recentRuns = getAllRecentRuns();
    const isNewUser = collections.length === 0;

    // Update time reference every 60 seconds for fresh "ago" displays
    const [now, setNow] = useState(() => Date.now());
    React.useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 60000);
        return () => clearInterval(interval);
    }, []);

    const formatTimeAgo = (ts) => {
        if (!ts) return '';
        const diff = now - ts;
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };

    const displayName = profile?.full_name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '';

    return (
        <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-8">
            <div className="max-w-5xl mx-auto">

                {isNewUser ? (
                    <>
                        {/* ===== NEW USER EXPERIENCE ===== */}
                        <HeroBanner onCreateCollection={handleNewCollection} onLoadDemo={handleLoadDemo} />
                        <CapabilityCards />
                        <FreePlanSummary onViewPricing={() => setCurrentView('pricing')} />

                        {/* Import options */}
                        <div className="flex flex-wrap gap-3 mb-8">
                            <button
                                onClick={() => setShowCurlImport(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-all active:scale-95"
                            >
                                <Terminal size={16} />
                                Import cURL
                            </button>
                            <button
                                onClick={() => setShowCollectionImport(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-all active:scale-95"
                            >
                                <Upload size={16} />
                                Import Collection
                            </button>
                        </div>
                    </>
                ) : (
                    <>
                        {/* ===== RETURNING USER EXPERIENCE ===== */}

                        {/* Greeting */}
                        <div className="mb-8">
                            <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                                {displayName ? `Welcome back, ${displayName}.` : 'Welcome to TestOrbit'}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {collections.length} collection{collections.length !== 1 ? 's' : ''}
                                {user && collections.filter(c => c.owner_id && c.owner_id !== user.id).length > 0 && (
                                    <span className="text-blue-500 dark:text-blue-400"> ({collections.filter(c => c.owner_id && c.owner_id !== user.id).length} shared)</span>
                                )}
                                {' '}&middot; AI-powered API testing
                            </p>
                        </div>

                        {/* Usage Stats */}
                        {usage && usage.limits.ai_calls > 0 && (
                            <div className="mb-8 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5">
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Today&apos;s Usage</h2>
                                    {subscription?.plan === 'free' && (
                                        <button
                                            onClick={() => setCurrentView('pricing')}
                                            className="text-[10px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                                        >
                                            Upgrade for Unlimited
                                        </button>
                                    )}
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    <UsageBar icon={<Sparkles size={13} className="text-purple-500" />} label="AI Calls" used={usage.ai_calls} limit={usage.limits.ai_calls} color="purple" />
                                    <UsageBar icon={<FlaskRound size={13} className="text-blue-500" />} label="Test Gen" used={usage.test_gen} limit={usage.limits.test_gen} color="blue" />
                                    <UsageBar icon={<Code size={13} className="text-emerald-500" />} label="Code Gen" used={usage.code_gen} limit={usage.limits.code_gen} color="emerald" />
                                </div>
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div className="flex flex-wrap gap-3 mb-8 items-center">
                            {showNewCollInput ? (
                                <div className="flex items-center gap-2">
                                    <input
                                        autoFocus
                                        type="text"
                                        value={newCollName}
                                        onChange={(e) => setNewCollName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') handleNewCollSubmit();
                                            if (e.key === 'Escape') { setShowNewCollInput(false); setNewCollName(''); }
                                        }}
                                        placeholder="Collection name..."
                                        className="px-3 py-2 text-sm border border-corporate-400 rounded-lg outline-none focus:ring-2 focus:ring-corporate-500/30 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 w-48"
                                    />
                                    <button
                                        onClick={handleNewCollSubmit}
                                        disabled={!newCollName.trim()}
                                        className="px-3 py-2 bg-corporate-600 hover:bg-corporate-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white text-sm font-semibold rounded-lg transition-colors"
                                    >
                                        Create
                                    </button>
                                    <button
                                        onClick={() => { setShowNewCollInput(false); setNewCollName(''); }}
                                        className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <button
                                    onClick={handleNewCollection}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-corporate-600 hover:bg-corporate-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-corporate-200 dark:shadow-none transition-all active:scale-95"
                                >
                                    <Plus size={16} />
                                    New Collection
                                </button>
                            )}
                            <button
                                onClick={() => setShowCurlImport(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-all active:scale-95"
                            >
                                <Terminal size={16} />
                                Import cURL
                            </button>
                            <button
                                onClick={() => setShowCollectionImport(true)}
                                className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-all active:scale-95"
                            >
                                <Upload size={16} />
                                Import Collection
                            </button>
                        </div>

                        {/* Collections Grid */}
                        <div className="mb-8">
                            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Collections</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {collections.map(col => {
                                    const itemCount = flattenItems(col.items, 'request').length;
                                    const testCount = (col.testSuites || []).length;
                                    const lastRun = getLastRunStats(col);

                                    return (
                                        <div
                                            key={col.id}
                                            onClick={() => handleOpenCollection(col.id)}
                                            className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 cursor-pointer hover:shadow-lg hover:border-corporate-300 dark:hover:border-corporate-600 hover:-translate-y-0.5 transition-all duration-200"
                                        >
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="w-9 h-9 bg-corporate-50 dark:bg-corporate-900/30 border border-corporate-200 dark:border-corporate-700 rounded-lg flex items-center justify-center">
                                                        <Folder size={18} className="text-corporate-600 dark:text-corporate-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-corporate-600 dark:group-hover:text-corporate-400 transition-colors">
                                                            {col.name}
                                                        </h3>
                                                        {(() => {
                                                            const colRole = getCollectionRole(col.id);
                                                            if (colRole === 'owner' || !colRole) return null;
                                                            return (
                                                                <div className="flex items-center gap-1.5 mt-0.5">
                                                                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
                                                                        <Users size={9} /> Shared
                                                                    </span>
                                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${colRole === 'editor'
                                                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600'
                                                                    }`}>
                                                                        {colRole === 'editor' ? <Pencil size={9} /> : <Shield size={9} />}
                                                                        {colRole === 'editor' ? 'Editor' : 'Viewer'}
                                                                    </span>
                                                                </div>
                                                            );
                                                        })()}
                                                    </div>
                                                </div>
                                                <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-corporate-500 transition-colors mt-1" />
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <FileText size={12} />
                                                    {itemCount} request{itemCount !== 1 ? 's' : ''}
                                                </span>
                                                {testCount > 0 && (
                                                    <span className="flex items-center gap-1">
                                                        <FlaskConical size={12} />
                                                        {testCount} test{testCount !== 1 ? 's' : ''}
                                                    </span>
                                                )}
                                            </div>

                                            {lastRun && (
                                                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                                    <div className="flex items-center justify-between text-[10px]">
                                                        <span className="text-slate-400 dark:text-slate-500">Last run</span>
                                                        <div className="flex items-center gap-2">
                                                            {lastRun.summary?.passed !== undefined && (
                                                                <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                                                                    <CheckCircle size={10} /> {lastRun.summary.passed}
                                                                </span>
                                                            )}
                                                            {lastRun.summary?.failed !== undefined && lastRun.summary.failed > 0 && (
                                                                <span className="flex items-center gap-0.5 text-red-500 dark:text-red-400">
                                                                    <XCircle size={10} /> {lastRun.summary.failed}
                                                                </span>
                                                            )}
                                                            <span className="text-slate-400 dark:text-slate-500">
                                                                {formatTimeAgo(lastRun.timestamp)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}

                                {/* Add Collection Card */}
                                <div
                                    onClick={handleNewCollection}
                                    className="bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-5 cursor-pointer hover:border-corporate-400 dark:hover:border-corporate-600 hover:bg-corporate-50/30 dark:hover:bg-corporate-900/10 transition-all flex flex-col items-center justify-center min-h-[140px]"
                                >
                                    <Plus size={24} className="text-slate-300 dark:text-slate-600 mb-2" />
                                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">New Collection</span>
                                </div>
                            </div>
                        </div>

                        {/* Recent Activity */}
                        {recentRuns.length > 0 && (
                            <div>
                                <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Recent Activity</h2>
                                <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                                    {recentRuns.map((run, idx) => (
                                        <div
                                            key={run.id || idx}
                                            onClick={() => handleOpenCollection(run.collectionId)}
                                            className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${idx < recentRuns.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''
                                                }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-2 h-2 rounded-full ${(run.summary?.failed || 0) > 0 ? 'bg-amber-400' : 'bg-green-400'
                                                    }`} />
                                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{run.collectionName}</span>
                                            </div>
                                            <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                                {run.summary?.passed !== undefined && (
                                                    <span className="text-green-600 dark:text-green-400">{run.summary.passed} passed</span>
                                                )}
                                                {(run.summary?.failed || 0) > 0 && (
                                                    <span className="text-red-500 dark:text-red-400">{run.summary.failed} failed</span>
                                                )}
                                                <span className="flex items-center gap-1 text-slate-400">
                                                    <Clock size={10} />
                                                    {formatTimeAgo(run.timestamp)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer links */}
            <div className="max-w-5xl mx-auto mt-8 pb-2">
                <div className="flex items-center justify-center gap-3 text-[11px] text-slate-400 dark:text-slate-500">
                    <button onClick={() => setCurrentView('pricing')} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                        Pricing
                    </button>
                    <span>&middot;</span>
                    <button onClick={() => setCurrentView('terms')} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                        Terms of Service
                    </button>
                    <span>&middot;</span>
                    <button onClick={() => setCurrentView('privacy')} className="hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                        Privacy Policy
                    </button>
                </div>
            </div>

            {/* Modals */}
            {showCurlImport && <CurlImportModal onClose={() => setShowCurlImport(false)} />}
            {showCollectionImport && <ImportCollectionModal onClose={() => setShowCollectionImport(false)} />}
        </div>
    );
};
