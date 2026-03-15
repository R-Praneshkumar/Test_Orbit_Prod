import React from 'react';
import { Rocket, Send, Upload, FlaskConical, Shield, ChevronRight, X, Check } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

/**
 * Onboarding checklist — shown on Dashboard for new users.
 * Tracks real progress based on store state. Dismissed permanently.
 */
export function OnboardingChecklist() {
    const collections = useWorkspaceStore(s => s.collections);
    const responses = useWorkspaceStore(s => s.responses);
    const dismissedOnboarding = useWorkspaceStore(s => s.dismissedOnboarding);
    const dismissOnboarding = useWorkspaceStore(s => s.dismissOnboarding);
    const setCurrentView = useWorkspaceStore(s => s.setCurrentView);

    if (dismissedOnboarding) return null;

    // Detect real progress
    const hasAccount = true; // They're logged in if they see this
    const hasSentRequest = Object.keys(responses || {}).length > 0;
    const hasMultipleRequests = collections.some(c => (c.items || []).length > 1);
    const hasTests = collections.some(c => (c.testSuites || []).length > 0);
    const hasOpenApiSpec = collections.some(c => c.openApiSpec && c.openApiSpec.trim().length > 10);

    const steps = [
        { id: 'account', label: 'Create your account', done: hasAccount, icon: Check },
        {
            id: 'request', label: 'Send your first API request', done: hasSentRequest, icon: Send,
            action: () => setCurrentView('workspace'),
            actionLabel: 'Try it',
        },
        {
            id: 'import', label: 'Import a collection or paste cURL', done: hasMultipleRequests, icon: Upload,
            action: null, // handled by Dashboard import buttons
            actionLabel: 'Import',
        },
        {
            id: 'tests', label: 'Generate AI tests for an endpoint', done: hasTests, icon: FlaskConical,
            action: () => setCurrentView('workspace'),
            actionLabel: 'Generate',
        },
        {
            id: 'spec', label: 'Add an OpenAPI spec to a collection', done: hasOpenApiSpec, icon: Shield,
            hint: 'Right-click a collection → Settings → paste your spec. This powers contract testing and smarter AI suggestions.',
        },
    ];

    const completed = steps.filter(s => s.done).length;
    const total = steps.length;
    const pct = Math.round((completed / total) * 100);

    // If all done, auto-dismiss after showing for 3 seconds
    if (completed === total) {
        setTimeout(() => dismissOnboarding(), 3000);
    }

    return (
        <div className="mb-6 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 relative">
            {/* Dismiss button */}
            <button
                onClick={dismissOnboarding}
                className="absolute top-3 right-3 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                aria-label="Dismiss onboarding"
            >
                <X size={14} />
            </button>

            {/* Header */}
            <div className="flex items-center gap-2.5 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
                    <Rocket size={16} className="text-white" />
                </div>
                <div className="flex-1">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Get Started with TestOrbit</h3>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">{completed}/{total} complete</p>
                </div>
            </div>

            {/* Progress bar */}
            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full mb-4 overflow-hidden">
                <div
                    className="h-full bg-gradient-to-r from-sky-400 to-blue-600 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                />
            </div>

            {/* Steps */}
            <div className="space-y-2">
                {steps.map(step => (
                    <div
                        key={step.id}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                            step.done
                                ? 'bg-emerald-50 dark:bg-emerald-900/10'
                                : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                    >
                        {/* Check icon */}
                        <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                            step.done
                                ? 'bg-emerald-500 text-white'
                                : 'border-2 border-slate-300 dark:border-slate-600'
                        }`}>
                            {step.done && <Check size={11} strokeWidth={3} />}
                        </div>

                        {/* Label */}
                        <span className={`text-xs flex-1 ${
                            step.done
                                ? 'text-emerald-700 dark:text-emerald-400 line-through'
                                : 'text-slate-700 dark:text-slate-300 font-medium'
                        }`}>
                            {step.label}
                        </span>

                        {/* Action button */}
                        {!step.done && step.action && (
                            <button
                                onClick={step.action}
                                className="flex items-center gap-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300 transition-colors"
                            >
                                {step.actionLabel} <ChevronRight size={10} />
                            </button>
                        )}
                    </div>
                ))}
            </div>

            {/* OpenAPI spec hint — show if not done */}
            {!hasOpenApiSpec && (
                <div className="mt-3 px-3 py-2 bg-sky-50 dark:bg-sky-900/10 rounded-lg border border-sky-200 dark:border-sky-800/50">
                    <p className="text-[10px] text-sky-700 dark:text-sky-300 leading-relaxed">
                        <strong>Pro tip:</strong> Right-click a collection → Settings → paste your OpenAPI/Swagger spec.
                        This unlocks AI-powered contract testing, smarter test generation, and auto-suggestions.
                        {' '}
                        <span className="text-sky-500 dark:text-sky-400">
                            Most frameworks can generate this automatically — Spring Boot needs just 1 dependency, .NET includes it by default.
                        </span>
                    </p>
                </div>
            )}
        </div>
    );
}
