import React, { useEffect } from 'react';
import { Sidebar } from './components/workspace/Sidebar';
import { TabManager } from './components/workspace/TabManager';
import { RequestEditor } from './components/workspace/RequestEditor';
import { IntelligencePanel } from './components/workspace/IntelligencePanel';
import { CollectionRunner } from './components/workspace/CollectionRunner';
import { WebSocketTester } from './components/workspace/WebSocketTester';
import { Dashboard } from './components/workspace/Dashboard';
import { MockServerPanel } from './components/workspace/MockServerPanel';
import { DocsPanel } from './components/workspace/DocsPanel';
import { TourGuide } from './components/common/TourGuide';
import { InteractiveTutorial } from './components/common/InteractiveTutorial';
import { useWorkspaceStore } from './store/workspaceStore';
import { Layout, Zap, Home, Wrench, Server, Book, Sun, Moon } from 'lucide-react';

function App() {
  const activeTabId = useWorkspaceStore(state => state.activeTabId);
  const runner = useWorkspaceStore(state => state.runner);
  const activeTabs = useWorkspaceStore(state => state.activeTabs);
  const activeCollectionId = useWorkspaceStore(state => state.activeCollectionId);
  const collections = useWorkspaceStore(state => state.collections);
  const currentView = useWorkspaceStore(state => state.currentView);
  const setCurrentView = useWorkspaceStore(state => state.setCurrentView);
  const darkMode = useWorkspaceStore(state => state.darkMode);
  const toggleDarkMode = useWorkspaceStore(state => state.toggleDarkMode);

  // Sync dark mode class with store state
  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Auto-start Welcome Tour
  const hasSeenWelcomeTour = useWorkspaceStore(state => state.hasSeenWelcomeTour);
  const startTour = useWorkspaceStore(state => state.startTour);

  useEffect(() => {
    if (!hasSeenWelcomeTour) {
      // Small delay to ensure UI is ready
      setTimeout(() => startTour('welcome'), 1000);
    }
  }, [hasSeenWelcomeTour, startTour]);

  // Check if activeTabId belongs to the current active collection
  const activeTabInCollection = (() => {
    if (!activeTabId || !activeCollectionId) return false;
    const tab = activeTabs.find(t => t.id === activeTabId);
    if (!tab) return false;
    if (tab.collectionId) return tab.collectionId === activeCollectionId;
    const col = collections.find(c => c.id === activeCollectionId);
    return col ? (col.items || []).some(i => i.id === activeTabId) : false;
  })();

  const visibleTabId = activeTabInCollection ? activeTabId : null;
  const visibleTab = visibleTabId ? activeTabs.find(t => t.id === visibleTabId) : null;

  // Global keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      const isMod = e.ctrlKey || e.metaKey;

      if (isMod && e.key === 'n') {
        e.preventDefault();
        const state = useWorkspaceStore.getState();
        const colId = state.activeCollectionId || state.collections[0]?.id;
        if (colId) state.addRequest(colId);
      }

      if (e.key === 'Escape') {
        const state = useWorkspaceStore.getState();
        if (state.runner) state.closeRunner();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-corporate-100">
      <TourGuide />
      <InteractiveTutorial />


      {/* App Header */}
      <header className="h-12 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 shrink-0 z-20">
        {/* Left: Logo */}
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-700 rounded-lg flex items-center justify-center shadow-sm">
            {/* Custom Orbit Icon */}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="12" cy="12" r="3" fill="white" />
              <circle cx="12" cy="12" r="8" stroke="white" strokeWidth="1.5" fill="none" opacity="0.6" />
              <circle cx="20" cy="12" r="2" fill="white" />
            </svg>
          </div>
          <span className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">TestOrbit</span>
          <span className="text-[9px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-700 px-1.5 py-0.5 rounded-full font-medium hidden sm:block">
            Powered by Gemini
          </span>
        </div>

        {/* Center: Navigation */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          <button
            onClick={() => setCurrentView('dashboard')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${currentView === 'dashboard'
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <Home size={13} />
            Home
          </button>
          <button
            data-tour="workspace-tab"
            onClick={() => setCurrentView('workspace')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${currentView === 'workspace'
              ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <Wrench size={13} />
            Workspace
          </button>
          <button
            data-tour="mock-server-tab"
            onClick={() => setCurrentView('mock-server')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${currentView === 'mock-server'
              ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 shadow-sm ring-1 ring-purple-200 dark:ring-purple-800'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <Server size={13} />
            Mock Server
          </button>
          <button
            data-tour="docs-tab"
            onClick={() => setCurrentView('docs')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${currentView === 'docs'
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-200 dark:ring-blue-800'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
          >
            <Book size={13} />
            Docs
          </button>
        </div>

        {/* Right: Dark mode toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            title="Toggle dark mode"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      {currentView === 'dashboard' ? (
        <Dashboard />
      ) : currentView === 'mock-server' ? (
        <MockServerPanel />
      ) : currentView === 'docs' ? (
        <DocsPanel />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* 1. Left Sidebar (Explorer) */}
          <div className="flex flex-col border-r border-slate-200 dark:border-slate-800" data-tour="sidebar">
            <Sidebar />
          </div>

          {/* 2. Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900">
            {!runner && <TabManager />}

            {runner ? (
              <CollectionRunner />
            ) : visibleTabId ? (
              visibleTab?.type === 'websocket'
                ? <WebSocketTester tabId={visibleTabId} />
                : <RequestEditor tabId={visibleTabId} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-900/50">
                <div className="w-20 h-20 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm rounded-xl flex items-center justify-center mb-6">
                  <Layout size={40} strokeWidth={1} />
                </div>
                <h2 className="text-xl font-medium text-slate-600 dark:text-slate-300 tracking-tight">Gemini Workspace</h2>
                <p className="max-w-xs text-center mt-2 text-sm text-slate-400 dark:text-slate-500">
                  Select a request from the explorer or ask the Intelligence Panel to build one for you.
                </p>
              </div>
            )}
          </div>

          {/* 3. Right Sidebar (Intelligence) */}
          <div className="flex flex-col border-l border-slate-200 dark:border-slate-800" data-tour="intelligence-panel">
            <IntelligencePanel />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
