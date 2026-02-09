import React from 'react';
import Joyride, { STATUS, ACTIONS, EVENTS } from 'react-joyride';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { X, ChevronRight, Check, ChevronLeft, Sparkles } from 'lucide-react';

// Custom Tooltip with Premium Design
const CustomTooltip = ({
    continuous,
    index,
    step,
    size,
    backProps,
    closeProps,
    primaryProps,
    tooltipProps,
    isLastStep,
}) => {
    return (
        <div
            {...tooltipProps}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-2xl max-w-md p-0 overflow-hidden animate-scale-in"
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-purple-50 to-slate-50 dark:from-purple-900/20 dark:to-slate-900">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 bg-purple-600 rounded-lg flex items-center justify-center">
                        <Sparkles size={12} className="text-white" />
                    </div>
                    <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                        Step {index + 1} of {size}
                    </span>
                </div>
                <button
                    {...closeProps}
                    className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 transition-colors"
                >
                    <X size={16} />
                </button>
            </div>

            {/* Content */}
            <div className="px-5 py-5">
                {step.title && (
                    <h3 className="text-lg font-bold text-slate-800 dark:text-slate-100 mb-2">
                        {step.title}
                    </h3>
                )}
                <div className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm">
                    {step.content}
                </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
                {index > 0 ? (
                    <button
                        {...backProps}
                        className="flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    >
                        <ChevronLeft size={16} />
                        Back
                    </button>
                ) : (
                    <button
                        {...closeProps}
                        className="text-sm font-medium text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                    >
                        Skip Tour
                    </button>
                )}

                <button
                    {...primaryProps}
                    className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-purple-500/20 transition-all transform hover:-translate-y-0.5 active:translate-y-0"
                >
                    {isLastStep ? (
                        <>
                            <Check size={16} />
                            Finish
                        </>
                    ) : (
                        <>
                            Next
                            <ChevronRight size={16} />
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export function TourGuide() {
    const activeTour = useWorkspaceStore(state => state.activeTour);
    const stopTour = useWorkspaceStore(state => state.stopTour);
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);

    // Define all tours with real, existing selectors
    const tours = {
        // ================= WELCOME TOUR =================
        'welcome': [
            {
                target: 'body',
                placement: 'center',
                disableBeacon: true,
                title: 'Welcome to Gemini API Tester! 🚀',
                content: (
                    <p>
                        This is your <strong>AI-native API testing tool</strong>. Let me give you a quick tour of the key features. You can skip at any time.
                    </p>
                ),
            },
            {
                target: '[data-tour="sidebar"]',
                placement: 'right',
                title: '1. Collection Explorer',
                content: (
                    <div>
                        <p className="mb-2">This is your <strong>left sidebar</strong>. Here you can:</p>
                        <ul className="list-disc pl-4 text-slate-500 dark:text-slate-400 text-xs space-y-1">
                            <li>Create and organize collections</li>
                            <li>Add HTTP requests or WebSocket connections</li>
                            <li>View run history and recent requests</li>
                            <li>Manage environment variables</li>
                        </ul>
                    </div>
                ),
            },
            {
                target: '[data-tour="workspace-tab"]',
                placement: 'bottom',
                title: '2. Workspace Tab',
                content: (
                    <p>
                        Click here to access the <strong>main workspace</strong> where you build and send requests. The center pane shows your request editor, and responses appear below.
                    </p>
                ),
            },
            {
                target: '[data-tour="mock-server-tab"]',
                placement: 'bottom',
                title: '3. AI Mock Server',
                content: (
                    <p>
                        <strong>No backend? No problem.</strong> Send requests to <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">/mock-server/&lt;any-path&gt;</code> and Gemini will invent realistic responses for you. Great for prototyping.
                    </p>
                ),
            },
            {
                target: '[data-tour="intelligence-panel"]',
                placement: 'left',
                title: '4. Gemini Intelligence Panel',
                content: (
                    <div>
                        <p className="mb-2">This is the <strong>brain of the app</strong>. It has three tabs:</p>
                        <ul className="list-disc pl-4 text-slate-500 dark:text-slate-400 text-xs space-y-1">
                            <li><strong>Chat:</strong> Describe APIs in plain English</li>
                            <li><strong>Spec:</strong> Paste OpenAPI/Swagger for context</li>
                            <li><strong>Tests:</strong> Generate full test suites with AI</li>
                        </ul>
                    </div>
                ),
            },
            {
                target: 'body',
                placement: 'center',
                title: 'You\'re Ready! 🎉',
                content: (
                    <p>
                        You now know the basics. Go explore! Remember, you can always access the <strong>Docs</strong> tab for more help. Happy testing!
                    </p>
                ),
            },
        ],

        // ================= MOCK SERVER TOUR =================
        'mock-server': [
            {
                target: '[data-tour="mock-server-tab"]',
                placement: 'bottom',
                disableBeacon: true,
                title: 'AI Mock Server',
                content: (
                    <p>
                        Welcome to the <strong>Mock Server</strong>! This feature lets Gemini create fake API responses instantly.
                    </p>
                ),
            },
            {
                target: 'body',
                placement: 'center',
                title: 'How It Works',
                content: (
                    <div>
                        <p className="mb-2">Just send any HTTP request to:</p>
                        <code className="block bg-slate-100 dark:bg-slate-700 p-2 rounded text-sm mb-2">
                            POST http://localhost:8000/mock-server/api/v1/users
                        </code>
                        <p>Gemini analyzes the path and method to generate a realistic JSON response. No setup needed!</p>
                    </div>
                ),
            },
        ],

        // ================= INTELLIGENCE PANEL TOUR =================
        'intelligence': [
            {
                target: '[data-tour="intelligence-panel"]',
                placement: 'left',
                disableBeacon: true,
                title: 'Gemini Intelligence',
                content: (
                    <p>
                        This is your AI copilot. It lives in the right sidebar and helps you build, test, and debug APIs.
                    </p>
                ),
            },
            {
                target: 'body',
                placement: 'center',
                title: 'Chat Tab',
                content: (
                    <p>
                        In the <strong>Chat</strong> tab, describe what you want: <em>"Test the /users endpoint with pagination"</em>. Gemini will suggest the method, URL, and payload.
                    </p>
                ),
            },
            {
                target: 'body',
                placement: 'center',
                title: 'Spec Tab',
                content: (
                    <p>
                        Paste your <strong>OpenAPI/Swagger JSON</strong> in the Spec tab. This gives the AI context about your entire API, making suggestions much more accurate.
                    </p>
                ),
            },
            {
                target: 'body',
                placement: 'center',
                title: 'Tests Tab',
                content: (
                    <p>
                        Click <strong>"Generate with AI"</strong> in the Tests tab. Gemini will create a full test suite: happy paths, edge cases, and security tests—all automatically.
                    </p>
                ),
            },
        ],

        // ================= TESTS TOUR =================
        'tests': [
            {
                target: '[data-tour="intelligence-panel"]',
                placement: 'left',
                disableBeacon: true,
                title: 'AI Test Generation',
                content: (
                    <p>
                        Open the <strong>Tests</strong> tab in the Intelligence Panel to generate comprehensive test suites automatically.
                    </p>
                ),
            },
            {
                target: 'body',
                placement: 'center',
                title: 'How to Generate',
                content: (
                    <div>
                        <ol className="list-decimal pl-4 text-slate-600 dark:text-slate-400 text-sm space-y-1">
                            <li>Select a collection from the sidebar</li>
                            <li>Click on the <strong>Tests</strong> tab</li>
                            <li>Optionally describe what to test (e.g., "focus on auth endpoints")</li>
                            <li>Click <strong>"Generate with AI"</strong></li>
                        </ol>
                    </div>
                ),
            },
        ],
    };

    const steps = tours[activeTour] || [];

    const handleCallback = (data) => {
        const { status, action, type, index } = data;

        // Handle tour completion or skip
        if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
            stopTour();
            return;
        }

        // Handle view switching on step change
        if (type === EVENTS.STEP_BEFORE) {
            const step = steps[index];
            // If a tour step targets something in workspace view, switch to it
            if (step?.target?.includes('sidebar') || step?.target?.includes('intelligence-panel')) {
                setCurrentView('workspace');
            }
            if (step?.target?.includes('mock-server-tab') && activeTour === 'mock-server') {
                setCurrentView('mock-server');
            }
        }
    };

    if (!activeTour || steps.length === 0) return null;

    return (
        <Joyride
            steps={steps}
            run={true}
            continuous
            showSkipButton
            showProgress
            scrollToFirstStep
            spotlightClicks
            callback={handleCallback}
            tooltipComponent={CustomTooltip}
            floaterProps={{
                styles: {
                    floater: {
                        filter: 'drop-shadow(0 4px 20px rgba(0,0,0,0.15))',
                    },
                },
            }}
            styles={{
                options: {
                    zIndex: 10000,
                    primaryColor: '#8b5cf6',
                },
                spotlight: {
                    borderRadius: 12,
                },
                overlay: {
                    backgroundColor: 'rgba(15, 23, 42, 0.75)',
                },
            }}
        />
    );
}
