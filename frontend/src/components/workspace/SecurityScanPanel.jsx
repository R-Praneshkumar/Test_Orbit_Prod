import React from 'react';
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, Info, ChevronDown, ChevronRight, X, Loader2 } from 'lucide-react';

const SEVERITY_CONFIG = {
    critical: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-200 dark:border-red-800', badge: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300', icon: ShieldAlert },
    high: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-200 dark:border-orange-800', badge: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300', icon: AlertTriangle },
    medium: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300', icon: AlertTriangle },
    low: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-200 dark:border-blue-800', badge: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300', icon: Info },
    info: { color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800', border: 'border-slate-200 dark:border-slate-700', badge: 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400', icon: Info },
};

const RISK_CONFIG = {
    critical: { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20', border: 'border-red-300 dark:border-red-700', label: 'Critical Risk' },
    high: { color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20', border: 'border-orange-300 dark:border-orange-700', label: 'High Risk' },
    medium: { color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20', border: 'border-amber-300 dark:border-amber-700', label: 'Medium Risk' },
    low: { color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20', border: 'border-blue-300 dark:border-blue-700', label: 'Low Risk' },
    secure: { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20', border: 'border-green-300 dark:border-green-700', label: 'Secure' },
};

function FindingCard({ finding, defaultExpanded = false }) {
    const [expanded, setExpanded] = React.useState(defaultExpanded);
    const sev = SEVERITY_CONFIG[finding.severity] || SEVERITY_CONFIG.info;
    const SevIcon = sev.icon;

    return (
        <div className={`rounded-lg border ${sev.border} overflow-hidden`}>
            <button
                onClick={() => setExpanded(!expanded)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left ${sev.bg} hover:opacity-90 transition-opacity`}
            >
                <SevIcon size={16} className={sev.color} />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{finding.title}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase ${sev.badge}`}>
                            {finding.severity}
                        </span>
                        {finding.source === 'ai' && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400">
                                AI
                            </span>
                        )}
                    </div>
                </div>
                {expanded ? <ChevronDown size={14} className="text-slate-400 shrink-0" /> : <ChevronRight size={14} className="text-slate-400 shrink-0" />}
            </button>
            {expanded && (
                <div className="px-4 py-3 bg-white dark:bg-slate-900 space-y-2 border-t border-slate-100 dark:border-slate-800">
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">{finding.description}</p>
                    {finding.recommendation && (
                        <div className="flex items-start gap-2 p-2.5 rounded-md bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                            <ShieldCheck size={13} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                            <p className="text-xs text-emerald-700 dark:text-emerald-300 leading-relaxed">{finding.recommendation}</p>
                        </div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
                        {finding.category && <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800">{finding.category.replace('_', ' ')}</span>}
                        {finding.id && <span>{finding.id}</span>}
                    </div>
                </div>
            )}
        </div>
    );
}

export function SecurityScanPanel({ result, loading, error, onClose }) {
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
                <Loader2 size={28} className="text-corporate-500 animate-spin" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Scanning for vulnerabilities...</p>
                <p className="text-xs text-slate-400 dark:text-slate-500">AI + static analysis running</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4">
                <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                        <Shield size={16} className="text-red-500" /> Security Scan Failed
                    </h3>
                    {onClose && <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400"><X size={14} /></button>}
                </div>
                <p className="text-xs text-red-500">{error}</p>
            </div>
        );
    }

    if (!result) return null;

    const { findings, summary } = result;
    const riskCfg = RISK_CONFIG[summary?.risk_level] || RISK_CONFIG.low;

    return (
        <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                    <Shield size={16} className="text-corporate-500" /> Security Scan Results
                </h3>
                {onClose && <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400"><X size={14} /></button>}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Risk Summary */}
                <div className={`rounded-xl border ${riskCfg.border} ${riskCfg.bg} p-4`}>
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            {summary.risk_level === 'secure' ? (
                                <ShieldCheck size={20} className={riskCfg.color} />
                            ) : (
                                <ShieldAlert size={20} className={riskCfg.color} />
                            )}
                            <span className={`text-base font-bold ${riskCfg.color}`}>{riskCfg.label}</span>
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                            Score: {summary.risk_score}
                        </span>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        {summary.critical > 0 && (
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300">
                                {summary.critical} Critical
                            </span>
                        )}
                        {summary.high > 0 && (
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300">
                                {summary.high} High
                            </span>
                        )}
                        {summary.medium > 0 && (
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                                {summary.medium} Medium
                            </span>
                        )}
                        {summary.low > 0 && (
                            <span className="text-xs font-semibold px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
                                {summary.low} Low
                            </span>
                        )}
                        {summary.total === 0 && (
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">
                                No vulnerabilities detected
                            </span>
                        )}
                    </div>
                    <div className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                        {result.scanned.method} {result.scanned.url} &middot; Status {result.scanned.status}
                    </div>
                </div>

                {/* Findings */}
                {findings.length > 0 && (
                    <div className="space-y-2">
                        {findings.map((finding, idx) => (
                            <FindingCard
                                key={finding.id || idx}
                                finding={finding}
                                defaultExpanded={idx === 0 || finding.severity === 'critical'}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default SecurityScanPanel;
