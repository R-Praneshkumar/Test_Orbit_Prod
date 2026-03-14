import React, { useState, useEffect } from 'react';
import { Folder, FlaskConical, CheckCircle, XCircle, Plus, Terminal, Upload, Clock, ArrowRight, FileText, Users, Shield, Pencil, Sparkles, Code, FlaskRound, MessageSquare, Server, Check, ArrowDownToLine, X } from 'lucide-react';
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

function HeroBanner({ onSignUp, onLoadDemo, onImport, onCompare, onMigrate, onAlternative }) {
    return (
        <div className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 dark:from-slate-950 dark:via-purple-950/20 dark:to-slate-950">
            {/* Subtle radial purple glow */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_30%_50%,rgba(124,58,237,0.13),transparent_60%)] pointer-events-none" />

            {/* Gradient fade into page background */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-b from-transparent to-slate-50 dark:to-slate-950 pointer-events-none z-[1]" />

            <div className="relative z-10 max-w-5xl mx-auto px-8 py-14 sm:py-16 flex flex-col lg:flex-row items-center gap-12">

                {/* LEFT: headline + bullets + CTAs */}
                <div className="flex-1 min-w-0">
                    <div className="inline-flex text-[11px] font-semibold text-orange-300 bg-orange-500/20 border border-orange-500/30 px-3 py-1 rounded-full mb-5">
                        Switching from Postman? Import in 30 seconds
                    </div>
                    <h1 className="text-3xl sm:text-4xl font-bold text-white leading-tight mb-4">
                        AI-powered API testing.<br />
                        <span className="text-purple-400">Free for teams.</span><br />
                        No credit limits.
                    </h1>
                    <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6 max-w-md">
                        Postman now charges $19/user/mo and gates AI behind 50 credits/month.
                        TestOrbit gives you <span className="text-white font-semibold">50 AI calls per day</span>, free
                        for teams of 3 &mdash; no credit card required.
                    </p>

                    {/* Competitor comparison bullets */}
                    <div className="space-y-2.5 mb-8">
                        <div className="flex items-center gap-2.5 text-sm text-slate-300">
                            <span className="text-green-400 text-base leading-none">✓</span>
                            <span><span className="text-white font-semibold">30x more AI free</span> &mdash; 50 calls/day vs Postman&apos;s 50/month</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm text-slate-300">
                            <span className="text-green-400 text-base leading-none">✓</span>
                            <span><span className="text-white font-semibold">4.5x cheaper</span> &mdash; 5-person team: $252/yr vs $1,140/yr</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm text-slate-300">
                            <span className="text-green-400 text-base leading-none">✓</span>
                            <span><span className="text-white font-semibold">Import in seconds</span> &mdash; Postman collections, environments, auth, scripts</span>
                        </div>
                        <div className="flex items-center gap-2.5 text-sm text-slate-300">
                            <span className="text-green-400 text-base leading-none">✓</span>
                            <span><span className="text-white font-semibold">Web-first, no bloat</span> &mdash; no Electron, loads in 2 seconds</span>
                        </div>
                    </div>

                    {/* CTAs */}
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={onSignUp}
                            className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-purple-900/40 transition-all active:scale-95"
                        >
                            <Plus size={15} />
                            Start Testing Free
                        </button>
                        <button
                            onClick={onImport}
                            className="flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-sm font-semibold rounded-lg shadow-lg shadow-orange-900/40 transition-all active:scale-95"
                        >
                            <Upload size={15} />
                            Import from Postman
                        </button>
                        <button
                            onClick={onLoadDemo}
                            className="flex items-center gap-2 px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-lg border border-white/20 transition-all active:scale-95"
                        >
                            <Sparkles size={15} />
                            See Demo
                        </button>
                    </div>

                    {/* SEO navigation links */}
                    <div className="flex flex-wrap gap-4 mt-5 text-xs">
                        <button onClick={onCompare} className="text-slate-400 hover:text-purple-300 underline underline-offset-2 transition-colors">
                            TestOrbit vs Postman
                        </button>
                        <button onClick={onMigrate} className="text-slate-400 hover:text-purple-300 underline underline-offset-2 transition-colors">
                            Migration Guide
                        </button>
                        <button onClick={onAlternative} className="text-slate-400 hover:text-purple-300 underline underline-offset-2 transition-colors">
                            Why TestOrbit?
                        </button>
                    </div>
                </div>

                {/* RIGHT: Terminal mockup (desktop only) */}
                <div className="hidden lg:block w-80 shrink-0">
                    <div className="bg-slate-950 border border-slate-700 rounded-xl overflow-hidden shadow-2xl shadow-black/50">
                        {/* Window chrome */}
                        <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-900 border-b border-slate-700">
                            <div className="w-3 h-3 rounded-full bg-red-500/70" />
                            <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                            <div className="w-3 h-3 rounded-full bg-green-500/70" />
                            <span className="ml-2 text-[11px] text-slate-400 font-mono">TestOrbit AI</span>
                        </div>
                        {/* Terminal body */}
                        <div className="p-4 font-mono text-xs space-y-1.5">
                            <div className="text-slate-400">$ Analyzing POST /api/users</div>
                            <div className="text-slate-700">──────────────────────────</div>
                            <div className="flex gap-2"><span className="text-green-400">✓</span><span className="text-slate-300">status is 200</span></div>
                            <div className="flex gap-2"><span className="text-green-400">✓</span><span className="text-slate-300">body.user.id exists</span></div>
                            <div className="flex gap-2"><span className="text-green-400">✓</span><span className="text-slate-300">email is valid format</span></div>
                            <div className="flex gap-2"><span className="text-green-400">✓</span><span className="text-slate-300">response &lt; 500ms</span></div>
                            <div className="flex gap-2"><span className="text-yellow-400">✓</span><span className="text-slate-300">rejects duplicate email</span></div>
                            <div className="flex gap-2"><span className="text-yellow-400">✓</span><span className="text-slate-300">validates required fields</span></div>
                            <div className="text-slate-700">──────────────────────────</div>
                            <div className="text-purple-400 font-semibold">+ 16 more tests generated</div>
                            <div className="text-slate-500 text-[10px]">Completed in 2.3s</div>
                        </div>
                    </div>
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
                        className={`rounded-xl border p-4 shadow-sm ${cap.bg} transition-all hover:shadow-md hover:-translate-y-0.5 duration-200`}
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
                    '50 AI calls per day',
                    '10 test generations per day',
                    '10 code generations per day',
                    'Import from Postman',
                    'All body types (JSON, Form, File)',
                    'WebSocket testing',
                    'Up to 3 team members',
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

function PostmanComparisonTable() {
    const rows = [
        { feature: 'AI calls (free)', postman: '50/month', testorbit: '50/day (~1,500/mo)', winner: 'testorbit' },
        { feature: 'Free team members', postman: '1 (solo only)', testorbit: 'Up to 3', winner: 'testorbit' },
        { feature: 'AI test generation', postman: 'Credit-gated', testorbit: '10/day free', winner: 'testorbit' },
        { feature: 'Collections & requests', postman: 'Unlimited', testorbit: 'Unlimited', winner: 'tie' },
        { feature: '5-person team cost', postman: '$1,140/yr', testorbit: '$252/yr', winner: 'testorbit' },
        { feature: 'Pro plan (individual)', postman: '$9/mo', testorbit: '$3/mo', winner: 'testorbit' },
        { feature: 'All body types', postman: true, testorbit: true, winner: 'tie' },
        { feature: 'WebSocket testing', postman: true, testorbit: true, winner: 'tie' },
        { feature: 'Import/Export', postman: true, testorbit: true, winner: 'tie' },
        { feature: 'Web-based (no install)', postman: false, testorbit: true, winner: 'testorbit' },
        { feature: 'INR pricing + UPI', postman: false, testorbit: true, winner: 'testorbit' },
    ];

    const renderVal = (val) => {
        if (val === true) return <Check size={13} className="text-emerald-500 mx-auto" />;
        if (val === false) return <X size={13} className="text-slate-300 dark:text-slate-600 mx-auto" />;
        return <span className="text-xs">{val}</span>;
    };

    return (
        <div className="mb-8 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100">TestOrbit vs Postman (March 2026)</h2>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Postman killed free teams and metered AI behind credits. Here&apos;s how we compare.</p>
            </div>
            <table className="w-full text-xs">
                <thead>
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                        <th className="text-left px-5 py-2.5 font-medium text-slate-500 dark:text-slate-400">Feature</th>
                        <th className="text-center px-4 py-2.5 font-medium text-slate-400 dark:text-slate-500 w-32">Postman</th>
                        <th className="text-center px-4 py-2.5 font-medium text-purple-600 dark:text-purple-400 w-32">TestOrbit</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row, i) => (
                        <tr key={i} className="border-b border-slate-50 dark:border-slate-800/50 last:border-0">
                            <td className="px-5 py-2 text-slate-700 dark:text-slate-300">{row.feature}</td>
                            <td className={`text-center px-4 py-2 ${row.winner === 'testorbit' ? 'text-slate-400 dark:text-slate-500' : 'text-slate-600 dark:text-slate-300'}`}>
                                {renderVal(row.postman)}
                            </td>
                            <td className={`text-center px-4 py-2 ${row.winner === 'testorbit' ? 'text-purple-700 dark:text-purple-300 font-semibold' : 'text-slate-600 dark:text-slate-300'}`}>
                                {renderVal(row.testorbit)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function MigrationSteps({ onImport }) {
    const steps = [
        { num: '1', title: 'Export from Postman', desc: 'Open Postman, right-click your collection, select "Export" as Collection v2.1 JSON.' },
        { num: '2', title: 'Import into TestOrbit', desc: 'Drag the JSON file into TestOrbit or click "Import Collection." Auth, scripts, folders, and variables are preserved.' },
        { num: '3', title: 'Start testing with AI', desc: 'Run your imported collection. AI generates tests, diagnoses errors, and suggests improvements instantly.' },
    ];

    return (
        <div className="mb-8">
            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Migrate from Postman in 3 steps</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {steps.map(step => (
                    <div key={step.num} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4">
                        <div className="w-7 h-7 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full flex items-center justify-center text-xs font-bold mb-3">
                            {step.num}
                        </div>
                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-1">{step.title}</h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">{step.desc}</p>
                    </div>
                ))}
            </div>
            <button
                onClick={onImport}
                className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
            >
                <Upload size={15} />
                Import Your Postman Collection Now
            </button>
        </div>
    );
}

function SocialProof() {
    return (
        <div className="mb-8 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950/20 dark:to-blue-950/20 border border-purple-200 dark:border-purple-800/30 rounded-xl p-6 text-center">
            <p className="text-sm text-slate-700 dark:text-slate-300 italic leading-relaxed max-w-lg mx-auto mb-3">
                &ldquo;Postman just priced us out at $19/user/mo. TestOrbit gave us AI-powered testing with our whole 3-person team for free. The import took 30 seconds.&rdquo;
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">&mdash; Early adopter, indie dev team</p>
        </div>
    );
}

function PostmanMigrationBanner({ onImport, onDismiss }) {
    return (
        <div className="mb-6 bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-orange-950/30 border border-orange-200 dark:border-orange-800/50 rounded-xl p-5 relative">
            <button
                onClick={onDismiss}
                className="absolute top-3 right-3 p-1 text-orange-300 dark:text-orange-700 hover:text-orange-500 dark:hover:text-orange-400 transition-colors"
                aria-label="Dismiss banner"
            >
                <X size={14} />
            </button>
            <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/40 rounded-lg flex items-center justify-center shrink-0">
                    <ArrowDownToLine size={20} className="text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-1">
                        Switching from Postman?
                    </h3>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                        Import your Postman collections and environments in seconds. All requests, folders, auth, scripts, and variables are preserved.
                    </p>
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={onImport}
                            className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-semibold rounded-lg transition-colors active:scale-95"
                        >
                            <Upload size={13} />
                            Import Postman Collection
                        </button>
                        <div className="flex items-center gap-3 text-[10px] text-slate-500 dark:text-slate-400">
                            <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> Auth &amp; scripts</span>
                            <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> Folders</span>
                            <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> Environments</span>
                            <span className="flex items-center gap-1"><Check size={10} className="text-green-500" /> All body types</span>
                        </div>
                    </div>
                </div>
            </div>
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
    const [migrationBannerDismissed, setMigrationBannerDismissed] = useState(() => {
        try { return localStorage.getItem('testorbit_migration_banner_dismissed') === 'true'; }
        catch { return false; }
    });

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
    // showHero: show hero + landing page only to non-logged-in guests (conversion funnel)
    const showHero = !user;

    // Update time reference every 15 seconds for fresh "ago" displays
    const [now, setNow] = useState(() => Date.now());
    React.useEffect(() => {
        const interval = setInterval(() => setNow(Date.now()), 15000);
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
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">

            {/* ===== HERO BANNER — full-bleed, outside p-8 container ===== */}
            {showHero && (
                <HeroBanner
                    onSignUp={() => setCurrentView('login')}
                    onLoadDemo={handleLoadDemo}
                    onImport={() => setShowCollectionImport(true)}
                    onCompare={() => setCurrentView('postman-vs-testorbit')}
                    onMigrate={() => setCurrentView('migrate-from-postman')}
                    onAlternative={() => setCurrentView('postman-alternative')}
                />
            )}

            {/* ===== PADDED CONTENT BELOW HERO ===== */}
            <div className={showHero ? 'px-8 pt-4 pb-8' : 'p-8'}>
                <div className="max-w-5xl mx-auto">

                    {!user && (
                        <>
                            <PostmanComparisonTable />
                            <MigrationSteps onImport={() => setShowCollectionImport(true)} />
                            <CapabilityCards />
                            <FreePlanSummary onViewPricing={() => setCurrentView('pricing')} />
                            <SocialProof />
                            <div className="flex flex-wrap gap-3 mb-8">
                                <button
                                    onClick={() => setShowCollectionImport(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg transition-all active:scale-95"
                                >
                                    <Upload size={16} />
                                    Import from Postman
                                </button>
                                <button
                                    onClick={() => setShowCurlImport(true)}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-all active:scale-95"
                                >
                                    <Terminal size={16} />
                                    Import cURL
                                </button>
                            </div>
                        </>
                    )}

                {!showHero && (
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
                                {user && collections.filter(c => c.team_id).length > 0 && (
                                    <span className="text-corporate-500 dark:text-corporate-400"> &middot; {collections.filter(c => c.team_id).length} team</span>
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
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                    <UsageBar icon={<Sparkles size={13} className="text-purple-500" />} label="AI Calls" used={usage.ai_calls} limit={usage.limits.ai_calls} color="purple" />
                                    <UsageBar icon={<FlaskRound size={13} className="text-blue-500" />} label="Test Gen" used={usage.test_gen} limit={usage.limits.test_gen} color="blue" />
                                    <UsageBar icon={<Code size={13} className="text-emerald-500" />} label="Code Gen" used={usage.code_gen} limit={usage.limits.code_gen} color="emerald" />
                                    {usage.limits.security_scan > 0 && (
                                        <UsageBar icon={<Shield size={13} className="text-corporate-500" />} label="Security Scan" used={usage.security_scan || 0} limit={usage.limits.security_scan} color="purple" />
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Postman Migration Banner */}
                        {!migrationBannerDismissed && collections.length < 3 && (
                            <PostmanMigrationBanner
                                onImport={() => setShowCollectionImport(true)}
                                onDismiss={() => {
                                    setMigrationBannerDismissed(true);
                                    try { localStorage.setItem('testorbit_migration_banner_dismissed', 'true'); }
                                    catch { /* ignore */ }
                                }}
                            />
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
                            <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">
                                {collections.some(c => c.team_id) ? 'My Collections' : 'Collections'}
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {collections.filter(c => !c.team_id).map(col => {
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

                        {/* Team Collections Grid */}
                        {(() => {
                            const teamCols = collections.filter(c => c.team_id);
                            if (teamCols.length === 0) return null;
                            // Group by team name
                            const teamGroups = {};
                            teamCols.forEach(c => {
                                const key = c.team_name || c.team_id || 'Team';
                                if (!teamGroups[key]) teamGroups[key] = [];
                                teamGroups[key].push(c);
                            });
                            return Object.entries(teamGroups).map(([teamName, cols]) => (
                                <div key={teamName} className="mb-8">
                                    <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                                        <Users size={13} className="text-corporate-500" /> {teamName}
                                    </h2>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {cols.map(col => {
                                            const itemCount = flattenItems(col.items, 'request').length;
                                            const testCount = (col.testSuites || []).length;
                                            const lastRun = getLastRunStats(col);
                                            const colRole = getCollectionRole(col.id);

                                            return (
                                                <div
                                                    key={col.id}
                                                    onClick={() => handleOpenCollection(col.id)}
                                                    className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 cursor-pointer hover:shadow-lg hover:border-corporate-300 dark:hover:border-corporate-600 hover:-translate-y-0.5 transition-all duration-200"
                                                >
                                                    <div className="flex items-start justify-between mb-3">
                                                        <div className="flex items-center gap-2.5">
                                                            <div className="w-9 h-9 bg-corporate-50 dark:bg-corporate-900/30 border border-corporate-200 dark:border-corporate-700 rounded-lg flex items-center justify-center">
                                                                <Users size={18} className="text-corporate-600 dark:text-corporate-400" />
                                                            </div>
                                                            <div>
                                                                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-corporate-600 dark:group-hover:text-corporate-400 transition-colors">
                                                                    {col.name}
                                                                </h3>
                                                                {colRole && colRole !== 'owner' && (
                                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 ${colRole === 'editor'
                                                                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-600'
                                                                    }`}>
                                                                        {colRole === 'editor' ? <Pencil size={9} /> : <Shield size={9} />}
                                                                        {colRole === 'editor' ? 'Editor' : 'Viewer'}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-corporate-500 transition-colors mt-1" />
                                                    </div>
                                                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                                        <span className="flex items-center gap-1">
                                                            <FileText size={12} /> {itemCount} request{itemCount !== 1 ? 's' : ''}
                                                        </span>
                                                        {testCount > 0 && (
                                                            <span className="flex items-center gap-1">
                                                                <FlaskConical size={12} /> {testCount} test{testCount !== 1 ? 's' : ''}
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
                                                                    <span className="text-slate-400 dark:text-slate-500">{formatTimeAgo(lastRun.timestamp)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ));
                        })()}

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
            </div>{/* end p-8 wrapper */}

            {/* Modals */}
            {showCurlImport && <CurlImportModal onClose={() => setShowCurlImport(false)} />}
            {showCollectionImport && <ImportCollectionModal onClose={() => setShowCollectionImport(false)} />}
        </div>
    );
};
