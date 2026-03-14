import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield, Users, Activity, BarChart3, RefreshCw,
    TrendingUp, Zap, FlaskConical, Code2, Lock,
    AlertTriangle, Mail, Eye, Send, X,
} from 'lucide-react';
import { API_BASE, authFetch } from '../../config';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { toast } from '../../utils/toast';

const STAT_ICONS = {
    ai_calls: Zap,
    test_gen: FlaskConical,
    code_gen: Code2,
    security_scan: Lock,
};

const STAT_COLORS = {
    ai_calls: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20',
    test_gen: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20',
    code_gen: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/20',
    security_scan: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20',
};

const STAT_LABELS = {
    ai_calls: 'AI Calls',
    test_gen: 'Test Generations',
    code_gen: 'Code Generations',
    security_scan: 'Security Scans',
};

function MetricCard({ label, value, icon, colorClass, subtitle }) {
    const CardIcon = icon;
    return (
        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 flex items-start gap-3">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
                <CardIcon size={18} />
            </div>
            <div className="min-w-0">
                <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">{value}</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</div>
                {subtitle && <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{subtitle}</div>}
            </div>
        </div>
    );
}

const DigestSection = () => {
    const [digestHtml, setDigestHtml] = useState(null);
    const [digestLoading, setDigestLoading] = useState(false);
    const [sendEmails, setSendEmails] = useState('');
    const [sending, setSending] = useState(false);

    const handlePreview = async () => {
        setDigestLoading(true);
        try {
            const res = await authFetch(`${API_BASE}/digest/preview`);
            if (!res.ok) {
                toast.error('Failed to load digest preview');
                return;
            }
            const data = await res.json();
            setDigestHtml(data.html);
        } catch {
            toast.error('Failed to connect to digest service');
        } finally {
            setDigestLoading(false);
        }
    };

    const handleSend = async () => {
        const emails = sendEmails.split(',').map(e => e.trim()).filter(Boolean);
        if (emails.length === 0) {
            toast.error('Enter at least one email address');
            return;
        }
        setSending(true);
        try {
            const res = await authFetch(`${API_BASE}/digest/send`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ to_emails: emails }),
            });
            if (!res.ok) {
                const err = await res.json();
                toast.error(err.detail || 'Failed to send digest');
                return;
            }
            toast.success(`Digest sent to ${emails.length} recipient(s)`);
            setSendEmails('');
        } catch {
            toast.error('Failed to send digest');
        } finally {
            setSending(false);
        }
    };

    return (
        <section className="mb-8">
            <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                <Mail size={14} /> Weekly Digest
            </h2>
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePreview}
                        disabled={digestLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors disabled:opacity-50"
                    >
                        <Eye size={12} /> {digestLoading ? 'Loading...' : 'Preview Digest'}
                    </button>
                </div>

                {digestHtml && (
                    <div className="relative">
                        <button
                            onClick={() => setDigestHtml(null)}
                            className="absolute top-2 right-2 p-1 rounded bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 z-10"
                        >
                            <X size={12} />
                        </button>
                        <iframe
                            srcDoc={digestHtml}
                            title="Digest Preview"
                            className="w-full h-80 border border-slate-200 dark:border-slate-600 rounded-lg bg-white"
                            sandbox=""
                        />
                    </div>
                )}

                <div className="flex gap-2">
                    <input
                        type="text"
                        value={sendEmails}
                        onChange={(e) => setSendEmails(e.target.value)}
                        placeholder="email1@example.com, email2@example.com"
                        className="flex-1 px-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-600 rounded-lg outline-none focus:ring-2 focus:ring-corporate-500 dark:text-slate-200"
                    />
                    <button
                        onClick={handleSend}
                        disabled={sending || !sendEmails.trim()}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-corporate-600 hover:bg-corporate-700 text-white rounded-lg transition-colors disabled:opacity-50"
                    >
                        <Send size={12} /> {sending ? 'Sending...' : 'Send Digest'}
                    </button>
                </div>
            </div>
        </section>
    );
};

const AdminPage = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/admin/stats`);
            if (res.status === 403) {
                setError('admin');
                return;
            }
            if (!res.ok) {
                setError('fetch');
                return;
            }
            const data = await res.json();
            setStats(data);
        } catch {
            setError('fetch');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStats();
    }, [fetchStats]);

    if (error === 'admin') {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-8">
                <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-900/20 flex items-center justify-center mb-4">
                    <AlertTriangle size={32} className="text-red-500" />
                </div>
                <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-1">Access Denied</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 text-center max-w-md mb-4">
                    Your account is not authorized to access the admin dashboard.
                    Contact the project owner to add your email to ADMIN_EMAILS.
                </p>
                <button
                    onClick={() => setCurrentView('workspace')}
                    className="px-4 py-2 bg-corporate-600 hover:bg-corporate-700 text-white rounded-lg text-sm font-semibold transition-colors"
                >
                    Back to Workspace
                </button>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
                <RefreshCw size={24} className="text-corporate-500 animate-spin" />
            </div>
        );
    }

    if (error === 'fetch' || !stats) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 p-8">
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">Failed to load admin stats.</p>
                <button onClick={fetchStats} className="px-3 py-1.5 bg-corporate-600 text-white rounded-lg text-xs font-semibold">
                    Retry
                </button>
            </div>
        );
    }

    const { active_users, usage_today, top_users, plan_limits, tracked_endpoints, total_tracked_users } = stats;

    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
            <div className="max-w-5xl mx-auto px-6 py-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-corporate-100 dark:bg-corporate-900/30 flex items-center justify-center">
                            <Shield size={20} className="text-corporate-600 dark:text-corporate-400" />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">Admin Dashboard</h1>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                Last updated: {new Date(stats.timestamp).toLocaleString()}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchStats}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        aria-label="Refresh stats"
                    >
                        <RefreshCw size={12} /> Refresh
                    </button>
                </div>

                {/* Active Users */}
                <section className="mb-8">
                    <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Users size={14} /> Active Users
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <MetricCard
                            label="Daily Active (DAU)"
                            value={active_users.dau}
                            icon={Activity}
                            colorClass="text-green-600 bg-green-50 dark:text-green-400 dark:bg-green-900/20"
                            subtitle="Unique users today"
                        />
                        <MetricCard
                            label="Weekly Active (WAU)"
                            value={active_users.wau}
                            icon={TrendingUp}
                            colorClass="text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20"
                            subtitle="Last 7 days"
                        />
                        <MetricCard
                            label="Monthly Active (MAU)"
                            value={active_users.mau}
                            icon={Users}
                            colorClass="text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20"
                            subtitle={`${total_tracked_users} total tracked`}
                        />
                    </div>
                </section>

                {/* Usage Today */}
                <section className="mb-8">
                    <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <BarChart3 size={14} /> Usage Today
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {Object.entries(usage_today).map(([key, val]) => {
                            const Icon = STAT_ICONS[key] || Zap;
                            return (
                                <MetricCard
                                    key={key}
                                    label={STAT_LABELS[key] || key}
                                    value={val}
                                    icon={Icon}
                                    colorClass={STAT_COLORS[key] || 'text-slate-600 bg-slate-50'}
                                    subtitle={`Free limit: ${plan_limits[key]}/day`}
                                />
                            );
                        })}
                    </div>
                </section>

                {/* Top Users Today */}
                {top_users.length > 0 && (
                    <section className="mb-8">
                        <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <TrendingUp size={14} /> Top Users Today
                        </h2>
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                            <table className="w-full text-xs">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                                        <th className="text-left px-4 py-2.5">User</th>
                                        <th className="text-right px-4 py-2.5">AI Calls</th>
                                        <th className="text-right px-4 py-2.5">Tests</th>
                                        <th className="text-right px-4 py-2.5">Codegen</th>
                                        <th className="text-right px-4 py-2.5">Security</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {top_users.map((u, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-4 py-2 font-mono text-slate-700 dark:text-slate-300">{u.user_id}</td>
                                            <td className="text-right px-4 py-2 text-slate-600 dark:text-slate-400">{u.ai_calls}</td>
                                            <td className="text-right px-4 py-2 text-slate-600 dark:text-slate-400">{u.test_gen}</td>
                                            <td className="text-right px-4 py-2 text-slate-600 dark:text-slate-400">{u.code_gen}</td>
                                            <td className="text-right px-4 py-2 text-slate-600 dark:text-slate-400">{u.security_scan}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}

                {/* Tracked Endpoints */}
                <section className="mb-8">
                    <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Activity size={14} /> Tracked Endpoints
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        {tracked_endpoints.map(ep => (
                            <span key={ep} className="px-2.5 py-1 text-[10px] font-mono font-semibold text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg">
                                {ep}
                            </span>
                        ))}
                    </div>
                </section>

                {/* Weekly Digest */}
                <DigestSection />
            </div>
        </div>
    );
};

export default AdminPage;
