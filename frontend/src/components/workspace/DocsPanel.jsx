import React from 'react';
import { Play, Server, Terminal, Keyboard, MessageSquare, FlaskConical, Folder, Send, ChevronRight, Sparkles, CheckCircle, Layers, Globe, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

// Feature Card Component
// eslint-disable-next-line no-unused-vars
const FeatureCard = ({ icon: Icon, title, description, color, tutorialName, onStart }) => (
    <div
        className="group relative p-5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/50 hover:border-purple-400 dark:hover:border-purple-500 hover:shadow-lg hover:shadow-purple-500/10 transition-all duration-300 cursor-pointer overflow-hidden"
        onClick={() => tutorialName && onStart(tutorialName)}
    >
        {/* Accent Bar */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-purple-500 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity" />

        <div className="flex items-start gap-4">
            <div className={`p-3 rounded-lg shrink-0 ${color === 'purple' ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' :
                color === 'green' ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400' :
                    color === 'blue' ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' :
                        'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                }`}>
                <Icon size={24} />
            </div>
            <div className="flex-1 min-w-0">
                <h3 className="font-bold text-slate-800 dark:text-slate-100 text-base mb-1 group-hover:text-slate-900 dark:group-hover:text-white transition-colors">{title}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed">{description}</p>
            </div>
            <ChevronRight size={18} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 group-hover:translate-x-1 transition-all shrink-0 mt-1" />
        </div>

        {tutorialName && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-400 dark:text-slate-500">Interactive Demo</span>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400 flex items-center gap-1">
                    <Play size={10} className="fill-current" /> Watch Demo
                </span>
            </div>
        )}
    </div>
);

// Quick Tip Component
const QuickTip = ({ emoji, text }) => (
    <div className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
        <span className="text-lg">{emoji}</span>
        <span className="text-sm text-amber-800 dark:text-amber-300">{text}</span>
    </div>
);

// Keyboard Shortcut Component
const Shortcut = ({ keys, action }) => (
    <div className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
        <span className="text-sm text-slate-600 dark:text-slate-400">{action}</span>
        <div className="flex items-center gap-1">
            {keys.map((key, i) => (
                <React.Fragment key={i}>
                    <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-mono rounded border border-slate-200 dark:border-slate-600 shadow-sm">
                        {key}
                    </kbd>
                    {i < keys.length - 1 && <span className="text-slate-400 text-xs">+</span>}
                </React.Fragment>
            ))}
        </div>
    </div>
);

export function DocsPanel() {
    const startTutorial = useWorkspaceStore(state => state.startTutorial);
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);

    return (
        <div className="flex-1 overflow-auto bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
            <div className="max-w-5xl mx-auto px-6 py-10">

                {/* Hero Header */}
                <div className="text-center mb-12">
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-sm font-medium mb-6">
                        <Sparkles size={16} className="animate-pulse" />
                        Built for the Gemini API Developer Competition
                    </div>
                    <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 dark:text-white mb-4 tracking-tight">
                        TestOrbit
                    </h1>
                    <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                        The AI-native testing tool that thinks alongside you. Generate tests, mock APIs, and debug errors—all powered by Google Gemini.
                    </p>

                    {/* CTA Buttons */}
                    <div className="flex flex-wrap items-center justify-center gap-4 mt-8">
                        <button
                            onClick={() => startTutorial('welcome')}
                            className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 transition-all flex items-center gap-2"
                        >
                            <Play size={18} className="fill-current" />
                            Take the Tour
                        </button>
                        <button
                            onClick={() => setCurrentView('workspace')}
                            className="px-6 py-3 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl border border-slate-200 dark:border-slate-700 transition-all flex items-center gap-2"
                        >
                            Go to Workspace
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </div>

                {/* Feature Grid */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                        <Layers size={20} className="text-purple-500" />
                        Core Features — Click to Watch Demo
                    </h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <FeatureCard
                            icon={MessageSquare}
                            title="AI Chat (Intelligence Panel)"
                            description="Describe any API in natural language: 'Test the login endpoint with email and password'. Gemini understands and builds it instantly."
                            color="purple"
                            tutorialName="intelligence"
                            onStart={startTutorial}
                        />
                        <FeatureCard
                            icon={FlaskConical}
                            title="AI Test Generation"
                            description="Click 'Generate with AI' to create a full test suite: happy paths, edge cases, security tests, and more. All from your OpenAPI spec."
                            color="green"
                            tutorialName="tests"
                            onStart={startTutorial}
                        />
                        <FeatureCard
                            icon={Server}
                            title="AI Mock Server"
                            description="No backend? No problem. Send requests to /mock-server/any/path and Gemini invents realistic JSON responses on the fly."
                            color="blue"
                            tutorialName="mock-server"
                            onStart={startTutorial}
                        />
                        <FeatureCard
                            icon={Terminal}
                            title="Agent Integration (MCP)"
                            description="Connect Claude, Cursor, or Windsurf to this tool. Agents can run tests and diagnose errors via the Model Context Protocol."
                            color="amber"
                            tutorialName={null}
                            onStart={startTutorial}
                        />
                    </div>
                </section>

                {/* Workspace Layout Guide */}
                <section className="mb-12 p-6 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                        <Globe size={20} className="text-blue-500" />
                        Workspace Anatomy
                    </h2>
                    <div className="grid md:grid-cols-3 gap-6">
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-3 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
                                <Folder size={28} className="text-slate-600 dark:text-slate-400" />
                            </div>
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Left: Explorer</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Manage collections, folders, requests, and WebSocket connections.</p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center">
                                <Send size={28} className="text-purple-600 dark:text-purple-400" />
                            </div>
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Center: Request Editor</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Build HTTP requests with headers, body, params, and view responses.</p>
                        </div>
                        <div className="text-center">
                            <div className="w-16 h-16 mx-auto mb-3 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                                <Sparkles size={28} className="text-green-600 dark:text-green-400" />
                            </div>
                            <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">Right: Intelligence</h4>
                            <p className="text-sm text-slate-500 dark:text-slate-400">Your AI copilot. Chat, paste specs, and generate tests.</p>
                        </div>
                    </div>
                </section>

                {/* Keyboard Shortcuts */}
                <section className="mb-12 p-6 bg-white dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <Keyboard size={20} className="text-amber-500" />
                        Keyboard Shortcuts
                    </h2>
                    <div className="grid md:grid-cols-2 gap-x-8">
                        <Shortcut keys={['Ctrl', 'N']} action="New Request" />
                        <Shortcut keys={['Ctrl', 'Enter']} action="Send Request" />
                        <Shortcut keys={['Ctrl', 'S']} action="Save Current" />
                        <Shortcut keys={['Esc']} action="Close Runner / Modal" />
                    </div>
                </section>

                {/* Quick Tips */}
                <section className="mb-12">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
                        <CheckCircle size={20} className="text-green-500" />
                        Pro Tips
                    </h2>
                    <div className="grid md:grid-cols-2 gap-4">
                        <QuickTip emoji="💡" text="Paste an OpenAPI/Swagger spec into the 'Spec' tab of the Intelligence Panel to supercharge AI accuracy." />
                        <QuickTip emoji="🚀" text="Right-click a collection and choose 'Run All' to execute every request in sequence." />
                        <QuickTip emoji="🔗" text="Use {{variable}} syntax in URLs and bodies. Manage variables in the Environment Manager (bottom of Sidebar)." />
                        <QuickTip emoji="🤖" text="Ask the AI to 'Generate tests for this API' in the Chat tab to create a full test suite." />
                    </div>
                </section>

                {/* Footer */}
                <footer className="text-center text-slate-400 dark:text-slate-500 text-sm pt-8 border-t border-slate-200 dark:border-slate-800">
                    <p>Made with 💜 for the Gemini API Developer Competition 2025</p>
                </footer>

            </div>
        </div>
    );
}
