import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Sparkles, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { useUpgradeStore } from '../../utils/upgradePrompt';
import { API_BASE, authFetch } from '../../config';

const CATEGORY_LABELS = {
    ai_calls: 'AI calls',
    test_gen: 'test generations',
    code_gen: 'code generations',
};

/** Yellow/red warning banner — shown below header when usage >= 80% */
export function UsageBanner() {
    const subscription = useWorkspaceStore(s => s.subscription);
    const setCurrentView = useWorkspaceStore(s => s.setCurrentView);
    const [usage, setUsage] = useState(null);
    const [dismissed, setDismissed] = useState(false);

    useEffect(() => {
        if (subscription?.plan !== 'free') return;
        let cancelled = false;
        authFetch(`${API_BASE}/usage/today`)
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (!cancelled && data) setUsage(data); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [subscription?.plan]);

    if (dismissed || !usage || subscription?.plan !== 'free') return null;

    // Find the most critical category
    const categories = ['ai_calls', 'test_gen', 'code_gen'];
    let worst = null;
    for (const cat of categories) {
        const limit = usage.limits?.[cat];
        if (limit > 0) {
            const pct = (usage[cat] / limit) * 100;
            if (pct >= 80 && (!worst || pct > worst.pct)) {
                worst = { cat, used: usage[cat], limit, pct };
            }
        }
    }

    if (!worst) return null;

    const isFull = worst.pct >= 100;
    const label = CATEGORY_LABELS[worst.cat] || worst.cat;

    return (
        <div className={`px-4 py-2 flex items-center justify-between text-xs font-medium shrink-0 ${
            isFull
                ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 border-b border-red-200 dark:border-red-800'
                : 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400 border-b border-amber-200 dark:border-amber-800'
        }`}>
            <div className="flex items-center gap-2">
                <AlertTriangle size={13} />
                <span>
                    {isFull
                        ? `You\u2019ve reached your daily ${label} limit (${worst.limit}).`
                        : `You\u2019ve used ${worst.used}/${worst.limit} ${label} today.`
                    }
                </span>
                <button
                    onClick={() => setCurrentView('pricing')}
                    className={`font-bold underline underline-offset-2 ${
                        isFull ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'
                    }`}
                >
                    Upgrade to Pro
                </button>
            </div>
            <button
                onClick={() => setDismissed(true)}
                className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
            >
                <X size={13} />
            </button>
        </div>
    );
}

/** Modal — shown when an AI call returns 429 DAILY_LIMIT_EXCEEDED */
export function UpgradeModal() {
    const { visible, category, used, limit, message, hide } = useUpgradeStore();
    const setCurrentView = useWorkspaceStore(s => s.setCurrentView);

    if (!visible) return null;

    const label = CATEGORY_LABELS[category] || 'AI calls';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 max-w-sm w-full mx-4 overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-purple-700 px-6 py-5 text-white text-center">
                    <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
                        <Sparkles size={24} />
                    </div>
                    <h2 className="text-lg font-bold">Daily Limit Reached</h2>
                    <p className="text-sm text-purple-200 mt-1">
                        {used}/{limit} {label} used today
                    </p>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                        {message || `You\u2019ve used all your free ${label} for today. Upgrade to Pro for unlimited AI-powered features.`}
                    </p>

                    <div className="space-y-2.5 mb-5">
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <Sparkles size={12} className="text-purple-500 shrink-0" />
                            <strong>Unlimited</strong>&nbsp;AI calls, test & code gen
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <Sparkles size={12} className="text-purple-500 shrink-0" />
                            Parallel test runner + full export history
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                            <Sparkles size={12} className="text-purple-500 shrink-0" />
                            Only <strong>&#8377;250/mo</strong> — cancel anytime
                        </div>
                    </div>

                    <button
                        onClick={() => { hide(); setCurrentView('pricing'); }}
                        className="w-full py-2.5 rounded-lg text-sm font-bold bg-purple-600 hover:bg-purple-700 text-white transition-colors flex items-center justify-center gap-2"
                    >
                        Upgrade to Pro <ArrowRight size={14} />
                    </button>
                </div>

                {/* Footer */}
                <div className="px-6 pb-4">
                    <button
                        onClick={hide}
                        className="w-full py-2 text-xs text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    >
                        Maybe later — limits reset at midnight UTC
                    </button>
                </div>
            </div>
        </div>
    );
}
