import React, { useState, useEffect, useCallback } from 'react';
import { X, Play, Pause, SkipForward, CheckCircle, Sparkles, ArrowRight, Server, MessageSquare, FlaskConical, ChevronRight } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

/**
 * InteractiveTutorial - A component that runs live demos by performing real UI actions
 * It navigates to pages, types in fields, clicks buttons, and shows results
 */
export function InteractiveTutorial() {
    const [activeTutorial, setActiveTutorial] = useState(null);
    const [currentStep, setCurrentStep] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [stepStatus, setStepStatus] = useState('waiting'); // 'waiting', 'running', 'done'

    // Store actions
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);
    const collections = useWorkspaceStore(state => state.collections);
    const setActiveCollection = useWorkspaceStore(state => state.setActiveCollection);
    const addCollectionChatMessage = useWorkspaceStore(state => state.addCollectionChatMessage);
    const stopTutorial = useWorkspaceStore(state => state.stopTutorial);
    const activeTutorialName = useWorkspaceStore(state => state.activeTutorial);

    // When store's activeTutorial changes, start the tutorial
    useEffect(() => {
        if (activeTutorialName) {
            setActiveTutorial(activeTutorialName);
            setCurrentStep(0);
            setIsPlaying(true);
            setStepStatus('waiting');
        } else {
            setActiveTutorial(null);
            setIsPlaying(false);
        }
    }, [activeTutorialName]);

    // Tutorial Definitions - Each tutorial has steps with actions
    const tutorials = {
        // ==================== INTELLIGENCE PANEL DEMO ====================
        'intelligence': {
            name: 'AI Intelligence Panel Demo',
            description: 'Watch how to use the AI chat to build API requests',
            steps: [
                {
                    title: 'Navigate to Workspace',
                    description: 'First, let\'s go to the workspace where the Intelligence Panel lives.',
                    action: async () => {
                        setCurrentView('workspace');
                        // Select first collection if exists
                        if (collections.length > 0) {
                            setActiveCollection(collections[0].id);
                        }
                        await sleep(500);
                    },
                },
                {
                    title: 'Open Intelligence Panel',
                    description: 'Look at the right sidebar - that\'s the Intelligence Panel with Chat, Spec, and Tests tabs.',
                    action: async () => {
                        // The panel should already be visible in workspace view
                        // Highlight it by scrolling or focusing
                        const panel = document.querySelector('[data-tour="intelligence-panel"]');
                        if (panel) {
                            panel.style.boxShadow = '0 0 0 4px rgba(139, 92, 246, 0.5)';
                            await sleep(2000);
                            panel.style.boxShadow = '';
                        }
                    },
                },
                {
                    title: 'Type a Prompt',
                    description: 'I\'ll type an example prompt: "Test GET https://jsonplaceholder.typicode.com/users/1"',
                    action: async () => {
                        // Find the chat textarea
                        const textarea = document.querySelector('.w-80 textarea');
                        if (textarea) {
                            const prompt = 'Test GET https://jsonplaceholder.typicode.com/users/1';
                            textarea.focus();
                            // Simulate typing
                            for (let i = 0; i <= prompt.length; i++) {
                                textarea.value = prompt.slice(0, i);
                                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                                await sleep(30);
                            }
                            await sleep(500);
                        }
                    },
                },
                {
                    title: 'Send to AI',
                    description: 'Now I\'ll click "Ask AI" to send this to Gemini.',
                    action: async () => {
                        // Find and click the submit button
                        const buttons = document.querySelectorAll('.w-80 button');
                        for (const btn of buttons) {
                            if (btn.textContent.includes('Ask AI') || btn.textContent.includes('Send')) {
                                btn.style.boxShadow = '0 0 0 4px rgba(139, 92, 246, 0.5)';
                                await sleep(500);
                                btn.click();
                                btn.style.boxShadow = '';
                                break;
                            }
                        }
                        await sleep(3000); // Wait for AI response
                    },
                },
                {
                    title: 'View AI Response',
                    description: 'Gemini analyzed the request and suggested a method, URL, and explanation. You can now click "Run" to execute it!',
                    action: async () => {
                        // Let the user see the response
                        await sleep(1000);
                    },
                },
            ],
        },

        // ==================== MOCK SERVER DEMO ====================
        'mock-server': {
            name: 'AI Mock Server Demo',
            description: 'See how Gemini creates fake API responses instantly',
            steps: [
                {
                    title: 'Navigate to Mock Server',
                    description: 'Let\'s go to the Mock Server panel.',
                    action: async () => {
                        setCurrentView('mock-server');
                        await sleep(500);
                    },
                },
                {
                    title: 'Understanding the Mock Server',
                    description: 'The Mock Server intercepts requests to /mock-server/* paths. Any request you send there gets a Gemini-generated response.',
                    action: async () => {
                        await sleep(2000);
                    },
                },
                {
                    title: 'Send a Mock Request (via curl)',
                    description: 'I\'ll show you what happens when you send: POST /mock-server/api/v1/products',
                    action: async () => {
                        // We can't actually run curl from frontend, but we can show the concept
                        // Instead, let's make an actual fetch request
                        try {
                            const response = await fetch('http://localhost:8000/mock-server/api/v1/products', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ name: 'Demo Product', price: 99.99 })
                            });
                            const data = await response.json();
                            console.log('Mock response:', data);
                        } catch (e) {
                            console.log('Mock server demo - request sent');
                        }
                        await sleep(1000);
                    },
                },
                {
                    title: 'View Generated Mock',
                    description: 'Click "Refresh" to see the new mock that was just created. Gemini invented a realistic response!',
                    action: async () => {
                        // Click refresh button if it exists
                        const refreshBtn = document.querySelector('button[title="Refresh"]');
                        if (refreshBtn) {
                            refreshBtn.style.boxShadow = '0 0 0 4px rgba(139, 92, 246, 0.5)';
                            await sleep(500);
                            refreshBtn.click();
                            refreshBtn.style.boxShadow = '';
                        }
                        await sleep(2000);
                    },
                },
            ],
        },

        // ==================== TEST GENERATION DEMO ====================
        'tests': {
            name: 'AI Test Generation Demo',
            description: 'Watch Gemini create a complete test suite',
            steps: [
                {
                    title: 'Go to Workspace',
                    description: 'Tests are generated per-collection. Let\'s go to the workspace first.',
                    action: async () => {
                        setCurrentView('workspace');
                        if (collections.length > 0) {
                            setActiveCollection(collections[0].id);
                        }
                        await sleep(500);
                    },
                },
                {
                    title: 'Open Tests Tab',
                    description: 'In the Intelligence Panel, click on the "Tests" tab.',
                    action: async () => {
                        // Find and click Tests tab
                        const tabs = document.querySelectorAll('.w-80 button');
                        for (const tab of tabs) {
                            if (tab.textContent.includes('Tests')) {
                                tab.style.boxShadow = '0 0 0 4px rgba(139, 92, 246, 0.5)';
                                await sleep(500);
                                tab.click();
                                tab.style.boxShadow = '';
                                break;
                            }
                        }
                        await sleep(500);
                    },
                },
                {
                    title: 'Describe What to Test',
                    description: 'You can optionally describe what to test. I\'ll type: "Test authentication and user endpoints"',
                    action: async () => {
                        const textarea = document.querySelector('.w-80 textarea');
                        if (textarea) {
                            const prompt = 'Test authentication and user endpoints';
                            textarea.focus();
                            for (let i = 0; i <= prompt.length; i++) {
                                textarea.value = prompt.slice(0, i);
                                textarea.dispatchEvent(new Event('input', { bubbles: true }));
                                await sleep(30);
                            }
                            await sleep(500);
                        }
                    },
                },
                {
                    title: 'Generate with AI',
                    description: 'Now click "Generate with AI" to create a full test suite.',
                    action: async () => {
                        const buttons = document.querySelectorAll('.w-80 button');
                        for (const btn of buttons) {
                            if (btn.textContent.includes('Generate with AI')) {
                                btn.style.boxShadow = '0 0 0 4px rgba(139, 92, 246, 0.5)';
                                await sleep(500);
                                btn.click();
                                btn.style.boxShadow = '';
                                break;
                            }
                        }
                        await sleep(5000); // Wait for generation
                    },
                },
                {
                    title: 'View Generated Tests',
                    description: 'Gemini created tests for happy paths, edge cases, and security scenarios. Click on a test suite to expand and see details!',
                    action: async () => {
                        await sleep(1000);
                    },
                },
            ],
        },

        // ==================== WELCOME TOUR (Overview) ====================
        'welcome': {
            name: 'Welcome Tour',
            description: 'A quick overview of all features',
            steps: [
                {
                    title: 'Welcome!',
                    description: 'Let me give you a quick tour of TestOrbit. This app helps you design, test, and mock APIs using AI.',
                    action: async () => {
                        setCurrentView('dashboard');
                        await sleep(1000);
                    },
                },
                {
                    title: 'The Workspace',
                    description: 'This is where you build and send API requests. It has 3 panels: Explorer (left), Request Editor (center), and Intelligence Panel (right).',
                    action: async () => {
                        setCurrentView('workspace');
                        await sleep(2000);
                    },
                },
                {
                    title: 'Mock Server',
                    description: 'The Mock Server creates fake API responses on the fly. Great for frontend development when your backend isn\'t ready.',
                    action: async () => {
                        setCurrentView('mock-server');
                        await sleep(2000);
                    },
                },
                {
                    title: 'Documentation',
                    description: 'You\'re here now! The Docs section has guides and interactive tutorials for every feature.',
                    action: async () => {
                        setCurrentView('docs');
                        await sleep(1000);
                    },
                },
            ],
        },
    };

    // Utility function for delays
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Run the current step
    const runStep = useCallback(async () => {
        if (!activeTutorial || !tutorials[activeTutorial]) return;

        const tutorial = tutorials[activeTutorial];
        const step = tutorial.steps[currentStep];

        if (!step) return;

        setStepStatus('running');

        try {
            await step.action();
        } catch (e) {
            console.error('Tutorial step error:', e);
        }

        setStepStatus('done');
    }, [activeTutorial, currentStep]);

    // Auto-run steps when playing
    useEffect(() => {
        if (isPlaying && stepStatus === 'waiting' && activeTutorial) {
            runStep();
        }
    }, [isPlaying, stepStatus, activeTutorial, runStep]);

    // Auto-advance after step is done (with delay for reading)
    useEffect(() => {
        if (stepStatus === 'done' && isPlaying) {
            const tutorial = tutorials[activeTutorial];
            if (currentStep < tutorial?.steps.length - 1) {
                const timer = setTimeout(() => {
                    setCurrentStep(prev => prev + 1);
                    setStepStatus('waiting');
                }, 2000); // 2 second pause between steps
                return () => clearTimeout(timer);
            } else {
                // Tutorial finished
                setIsPlaying(false);
            }
        }
    }, [stepStatus, isPlaying, currentStep, activeTutorial]);

    // Close handler
    const handleClose = () => {
        setActiveTutorial(null);
        setIsPlaying(false);
        setCurrentStep(0);
        if (stopTutorial) stopTutorial();
    };

    // Skip to next step
    const handleSkip = () => {
        const tutorial = tutorials[activeTutorial];
        if (currentStep < tutorial?.steps.length - 1) {
            setCurrentStep(prev => prev + 1);
            setStepStatus('waiting');
        } else {
            handleClose();
        }
    };

    if (!activeTutorial || !tutorials[activeTutorial]) return null;

    const tutorial = tutorials[activeTutorial];
    const step = tutorial.steps[currentStep];
    const progress = ((currentStep + 1) / tutorial.steps.length) * 100;

    return (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-lg px-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
                {/* Progress Bar */}
                <div className="h-1 bg-slate-100 dark:bg-slate-800">
                    <div
                        className="h-full bg-purple-600 transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    />
                </div>

                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                            <Sparkles size={16} className="text-purple-600 dark:text-purple-400" />
                        </div>
                        <div>
                            <div className="text-sm font-bold text-slate-800 dark:text-slate-100">{tutorial.name}</div>
                            <div className="text-xs text-slate-400">Step {currentStep + 1} of {tutorial.steps.length}</div>
                        </div>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-colors"
                    >
                        <X size={16} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-4 py-4">
                    <h4 className="font-semibold text-slate-800 dark:text-slate-100 mb-1 flex items-center gap-2">
                        {stepStatus === 'running' && (
                            <span className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" />
                        )}
                        {stepStatus === 'done' && (
                            <CheckCircle size={16} className="text-green-500" />
                        )}
                        {step?.title}
                    </h4>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{step?.description}</p>
                </div>

                {/* Controls */}
                <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-950 border-t border-slate-100 dark:border-slate-800">
                    <button
                        onClick={() => setIsPlaying(!isPlaying)}
                        className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                    >
                        {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                        {isPlaying ? 'Pause' : 'Resume'}
                    </button>
                    <button
                        onClick={handleSkip}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        {currentStep < tutorial.steps.length - 1 ? (
                            <>
                                Skip <SkipForward size={14} />
                            </>
                        ) : (
                            <>
                                Finish <CheckCircle size={14} />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
