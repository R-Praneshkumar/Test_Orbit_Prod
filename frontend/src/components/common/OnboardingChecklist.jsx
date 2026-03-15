import React, { useState } from 'react';
import { Rocket, Send, Upload, FlaskConical, Shield, ChevronRight, X, Check, Sparkles, Terminal, Settings, BookOpen } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

/**
 * Onboarding checklist — shown on Dashboard until ALL steps are complete.
 * User can ONLY dismiss after completing all steps.
 * Tracks real progress based on store state.
 */
export function OnboardingChecklist() {
    const collections = useWorkspaceStore(s => s.collections);
    const responses = useWorkspaceStore(s => s.responses);
    const dismissedOnboarding = useWorkspaceStore(s => s.dismissedOnboarding);
    const dismissOnboarding = useWorkspaceStore(s => s.dismissOnboarding);
    const setCurrentView = useWorkspaceStore(s => s.setCurrentView);
    const [showSpecGuide, setShowSpecGuide] = useState(false);

    if (dismissedOnboarding) return null;

    // Detect real progress from store state
    const hasAccount = true;
    const hasSentRequest = Object.keys(responses || {}).length > 0;
    const hasMultipleRequests = collections.some(c => (c.items || []).length > 1);
    const hasTests = collections.some(c => (c.testSuites || []).length > 0);
    const hasOpenApiSpec = collections.some(c => c.openApiSpec && c.openApiSpec.trim().length > 10);

    const steps = [
        {
            id: 'account', label: 'Create your account', done: hasAccount, icon: Check,
        },
        {
            id: 'request', label: 'Send your first API request', done: hasSentRequest, icon: Send,
            action: () => setCurrentView('workspace'),
            actionLabel: 'Open Workspace',
            hint: 'Go to Workspace → click a request → click Send',
        },
        {
            id: 'import', label: 'Import a collection or paste cURL', done: hasMultipleRequests, icon: Upload,
            actionLabel: 'Import',
            hint: 'Click "Import Collection" or "Import cURL" below to bring in your existing API requests',
        },
        {
            id: 'tests', label: 'Generate AI tests for an endpoint', done: hasTests, icon: FlaskConical,
            action: () => setCurrentView('workspace'),
            actionLabel: 'Open Workspace',
            hint: 'Hover a collection in sidebar → click the flask (🧪) icon → click "Generate with AI"',
        },
        {
            id: 'spec', label: 'Add an OpenAPI spec to a collection', done: hasOpenApiSpec, icon: Shield,
            action: () => setShowSpecGuide(!showSpecGuide),
            actionLabel: showSpecGuide ? 'Hide Guide' : 'Show How',
            hint: 'Hover a collection → click the gear (⚙) icon → Overview tab → paste your spec',
        },
    ];

    const completed = steps.filter(s => s.done).length;
    const total = steps.length;
    const pct = Math.round((completed / total) * 100);
    const allDone = completed === total;

    return (
        <div className="mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            {/* Header */}
            <div className="px-5 pt-5 pb-0">
                <div className="flex items-center gap-2.5 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center shrink-0">
                        <Rocket size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                            {allDone ? 'All done! You\'re ready to go.' : 'Get Started with TestOrbit'}
                        </h3>
                        <p className="text-[10px] text-slate-500 dark:text-slate-400">{completed}/{total} complete</p>
                    </div>
                    {/* Dismiss — only when ALL done */}
                    {allDone && (
                        <button
                            onClick={dismissOnboarding}
                            className="text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors px-2 py-1 rounded-md hover:bg-sky-50 dark:hover:bg-sky-900/20"
                        >
                            Dismiss
                        </button>
                    )}
                </div>

                {/* Progress bar */}
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mb-4 overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-700 ${allDone ? 'bg-emerald-500' : 'bg-gradient-to-r from-sky-400 to-blue-600'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            </div>

            {/* Steps */}
            <div className="px-3 pb-3 space-y-1">
                {steps.map(step => (
                    <div key={step.id}>
                        <div
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                                step.done
                                    ? 'bg-emerald-50 dark:bg-emerald-900/10'
                                    : 'bg-slate-50 dark:bg-slate-800/50'
                            }`}
                        >
                            {/* Check circle */}
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                                step.done
                                    ? 'bg-emerald-500 text-white'
                                    : 'border-2 border-slate-300 dark:border-slate-600'
                            }`}>
                                {step.done && <Check size={11} strokeWidth={3} />}
                            </div>

                            {/* Label + hint */}
                            <div className="flex-1 min-w-0">
                                <span className={`text-xs block ${
                                    step.done
                                        ? 'text-emerald-700 dark:text-emerald-400 line-through'
                                        : 'text-slate-700 dark:text-slate-300 font-medium'
                                }`}>
                                    {step.label}
                                </span>
                                {!step.done && step.hint && (
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">
                                        {step.hint}
                                    </span>
                                )}
                            </div>

                            {/* Action button */}
                            {!step.done && step.action && (
                                <button
                                    onClick={step.action}
                                    className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors shrink-0 px-2 py-1 rounded-md hover:bg-sky-50 dark:hover:bg-sky-900/20"
                                >
                                    {step.actionLabel} <ChevronRight size={10} />
                                </button>
                            )}
                        </div>

                        {/* Expandable OpenAPI spec guide */}
                        {step.id === 'spec' && showSpecGuide && !step.done && (
                            <div className="mx-3 mt-1 mb-2 p-3 bg-sky-50 dark:bg-sky-900/10 rounded-lg border border-sky-200 dark:border-sky-800/50">
                                <p className="text-[11px] font-semibold text-slate-700 dark:text-slate-200 mb-2">
                                    How to add an OpenAPI spec:
                                </p>
                                <div className="space-y-2 text-[10px] text-slate-600 dark:text-slate-400">
                                    <div className="flex items-start gap-2">
                                        <span className="text-sky-500 font-bold shrink-0">1.</span>
                                        <span>Hover a collection in the sidebar → click the <Settings size={10} className="inline" /> gear icon</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-sky-500 font-bold shrink-0">2.</span>
                                        <span>Go to the <strong>Overview</strong> tab</span>
                                    </div>
                                    <div className="flex items-start gap-2">
                                        <span className="text-sky-500 font-bold shrink-0">3.</span>
                                        <span>Paste your OpenAPI/Swagger JSON or YAML into the spec field</span>
                                    </div>
                                </div>

                                <div className="mt-3 pt-2 border-t border-sky-200 dark:border-sky-800/50">
                                    <p className="text-[10px] font-semibold text-slate-700 dark:text-slate-200 mb-1.5">
                                        Don&apos;t have a spec? Here&apos;s how to generate one:
                                    </p>
                                    <div className="space-y-1.5 text-[10px] text-slate-600 dark:text-slate-400">
                                        <div className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="font-mono text-[9px] text-amber-600 dark:text-amber-400 shrink-0 w-20">Spring Boot</span>
                                            <span>Add <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[9px]">springdoc-openapi-starter-webmvc-ui</code> dependency → auto at <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[9px]">/v3/api-docs</code></span>
                                        </div>
                                        <div className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="font-mono text-[9px] text-blue-600 dark:text-blue-400 shrink-0 w-20">.NET</span>
                                            <span>Already included! Check <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[9px]">/swagger/v1/swagger.json</code></span>
                                        </div>
                                        <div className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="font-mono text-[9px] text-green-600 dark:text-green-400 shrink-0 w-20">FastAPI</span>
                                            <span>Already included! Check <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[9px]">/openapi.json</code></span>
                                        </div>
                                        <div className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="font-mono text-[9px] text-purple-600 dark:text-purple-400 shrink-0 w-20">Django</span>
                                            <span>Add <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[9px]">drf-spectacular</code> → 3 lines config</span>
                                        </div>
                                        <div className="flex items-center gap-2 px-2 py-1 bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                                            <span className="font-mono text-[9px] text-slate-600 dark:text-slate-400 shrink-0 w-20">Express.js</span>
                                            <span>Add <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[9px]">swagger-jsdoc</code> + <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded text-[9px]">swagger-ui-express</code></span>
                                        </div>
                                    </div>
                                    <p className="text-[9px] text-sky-600 dark:text-sky-400 mt-2">
                                        Coming soon: Connect your GitHub repo and we&apos;ll auto-generate the spec from your source code.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* All done celebration */}
            {allDone && (
                <div className="px-5 pb-4 pt-1">
                    <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg">
                        <Sparkles size={14} className="text-emerald-500" />
                        <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                            You&apos;re all set! You&apos;ve explored the key features. Happy testing!
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
