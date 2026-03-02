import React, { useEffect, useCallback, Suspense, lazy } from 'react';
import { Sidebar } from './components/workspace/Sidebar';
import { TabManager } from './components/workspace/TabManager';
import { ResizeHandle } from './components/workspace/ResizeHandle';
import { useWorkspaceStore, flattenItems } from './store/workspaceStore';
import { Layout, Home, Wrench, Server, Book, Sun, Moon, Wifi, WifiOff, PanelLeftOpen, PanelRightOpen, FolderTree, Search, Sparkles, MessageSquare, FlaskConical } from 'lucide-react';
import AuthPage from './components/common/AuthPage';
import UserMenu from './components/common/UserMenu';
import GuestBanner from './components/common/GuestBanner';
import { ToastContainer } from './components/common/Toast';
import { UsageBanner, UpgradeModal } from './components/common/UpgradePrompt';

// Lazy-loaded panels — each gets its own chunk
const RequestEditor = lazy(() => import('./components/workspace/RequestEditor').then(m => ({ default: m.RequestEditor })));
const IntelligencePanel = lazy(() => import('./components/workspace/IntelligencePanel').then(m => ({ default: m.IntelligencePanel })));
const CollectionRunner = lazy(() => import('./components/workspace/CollectionRunner').then(m => ({ default: m.CollectionRunner })));
const WebSocketTester = lazy(() => import('./components/workspace/WebSocketTester').then(m => ({ default: m.WebSocketTester })));
const Dashboard = lazy(() => import('./components/workspace/Dashboard').then(m => ({ default: m.Dashboard })));
const CollectionSettings = lazy(() => import('./components/workspace/CollectionSettings').then(m => ({ default: m.CollectionSettings })));
const TestDashboard = lazy(() => import('./components/workspace/TestDashboard').then(m => ({ default: m.TestDashboard })));
const MockServerPanel = lazy(() => import('./components/workspace/MockServerPanel').then(m => ({ default: m.MockServerPanel })));
const DocsPanel = lazy(() => import('./components/workspace/DocsPanel').then(m => ({ default: m.DocsPanel })));
const ProfilePage = lazy(() => import('./components/common/ProfilePage'));
const PricingPage = lazy(() => import('./components/common/PricingPage'));
const TermsOfService = lazy(() => import('./components/common/LegalPages').then(m => ({ default: m.TermsOfService })));
const PrivacyPolicy = lazy(() => import('./components/common/LegalPages').then(m => ({ default: m.PrivacyPolicy })));

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
  const localMode = useWorkspaceStore(state => state.localMode);
  const toggleLocalMode = useWorkspaceStore(state => state.toggleLocalMode);
  const sidebarCollapsed = useWorkspaceStore(state => state.sidebarCollapsed);
  const toggleSidebar = useWorkspaceStore(state => state.toggleSidebar);
  const intelligenceCollapsed = useWorkspaceStore(state => state.intelligenceCollapsed);
  const toggleIntelligence = useWorkspaceStore(state => state.toggleIntelligence);
  const sidebarWidth = useWorkspaceStore(state => state.sidebarWidth);
  const setSidebarWidth = useWorkspaceStore(state => state.setSidebarWidth);
  const intelligenceWidth = useWorkspaceStore(state => state.intelligenceWidth);
  const setIntelligenceWidth = useWorkspaceStore(state => state.setIntelligenceWidth);
  const initializeAuth = useWorkspaceStore(state => state.initializeAuth);

  const handleSidebarResize = useCallback((clientX) => {
    setSidebarWidth(clientX);
  }, [setSidebarWidth]);

  const handleIntelligenceResize = useCallback((clientX) => {
    setIntelligenceWidth(window.innerWidth - clientX);
  }, [setIntelligenceWidth]);

  // Init Supabase Auth once on mount — must not re-run on dark mode change (auth listener leak)
  useEffect(() => {
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [darkMode]);

  // Responsive auto-collapse on small screens
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      const store = useWorkspaceStore.getState();
      if (w < 1200 && !store.intelligenceCollapsed) store.toggleIntelligence();
      if (w < 900 && !store.sidebarCollapsed) store.toggleSidebar();
    };
    window.addEventListener('resize', handleResize);
    handleResize(); // run once on mount
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check if activeTabId belongs to the current active collection
  const activeTabInCollection = (() => {
    if (!activeTabId || !activeCollectionId) return false;
    const tab = activeTabs.find(t => t.id === activeTabId);
    if (!tab) return false;
    if (tab.collectionId) return tab.collectionId === activeCollectionId;
    const col = collections.find(c => c.id === activeCollectionId);
    return col ? flattenItems(col.items).some(i => i.id === activeTabId) : false;
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

      // Ctrl+S — prevent browser save dialog (data is auto-saved via Zustand persist)
      if (isMod && e.key === 's') {
        e.preventDefault();
      }

      // Ctrl+B — toggle sidebar, Ctrl+J — toggle intelligence panel
      if (isMod && e.key === 'b') {
        e.preventDefault();
        useWorkspaceStore.getState().toggleSidebar();
      }
      if (isMod && e.key === 'j') {
        e.preventDefault();
        useWorkspaceStore.getState().toggleIntelligence();
      }

      if (e.key === 'Escape') {
        const state = useWorkspaceStore.getState();
        if (state.runner) state.closeRunner();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Login and Profile views render without the header/nav chrome
  if (currentView === 'login') {
    return (
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
        <AuthPage />
        <ToastContainer />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans selection:bg-corporate-100">
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

        {/* Right: User Menu, Local Mode & Dark mode */}
        <div className="flex items-center gap-2">
          <UserMenu />
          <button
            onClick={toggleLocalMode}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold transition-colors ${
              localMode
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
            }`}
            title={localMode ? 'Local Mode ON — requests sent directly from browser (supports localhost)' : 'Cloud Mode — requests routed through server proxy'}
          >
            {localMode ? <Wifi size={13} /> : <WifiOff size={13} />}
            {localMode ? 'Local' : 'Cloud'}
          </button>
          <button
            onClick={toggleDarkMode}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
            title="Toggle dark mode"
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </header>

      {/* Guest Banner */}
      <GuestBanner />
      <UsageBanner />

      {/* Main Content */}
      <Suspense fallback={<div className="flex-1 flex items-center justify-center"><div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" /></div>}>
      {currentView === 'profile' ? (
        <ProfilePage />
      ) : currentView === 'pricing' ? (
        <PricingPage />
      ) : currentView === 'terms' ? (
        <TermsOfService />
      ) : currentView === 'privacy' ? (
        <PrivacyPolicy />
      ) : currentView === 'dashboard' ? (
        <Dashboard />
      ) : currentView === 'mock-server' ? (
        <MockServerPanel />
      ) : currentView === 'docs' ? (
        <DocsPanel />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* 1. Left Sidebar (Explorer) — collapsible */}
          {sidebarCollapsed ? (
            <div className="w-10 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-800 flex flex-col items-center py-2 gap-2 shrink-0">
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400 transition-colors"
                title="Expand Explorer"
              >
                <PanelLeftOpen size={16} />
              </button>
              <div className="w-6 border-t border-slate-200 dark:border-slate-700" />
              <button
                onClick={() => { toggleSidebar(); }}
                className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 transition-colors"
                title="Explorer"
              >
                <FolderTree size={14} />
              </button>
              <button
                onClick={() => { toggleSidebar(); }}
                className="p-1.5 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 transition-colors"
                title="Search"
              >
                <Search size={14} />
              </button>
            </div>
          ) : (
            <>
              <div className="flex flex-col border-r border-slate-200 dark:border-slate-800 shrink-0" style={{ width: sidebarWidth }} data-tour="sidebar">
                <Sidebar onCollapse={toggleSidebar} />
              </div>
              <ResizeHandle onResize={handleSidebarResize} />
            </>
          )}

          {/* 2. Main Content Area */}
          <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-900">
            {!runner && <TabManager />}

            {runner ? (
              <CollectionRunner />
            ) : visibleTabId ? (
              visibleTab?.type === 'collection-settings'
                ? <CollectionSettings collectionId={visibleTab.collectionId} />
                : visibleTab?.type === 'test-dashboard'
                  ? <TestDashboard collectionId={visibleTab.collectionId} folderId={visibleTab.folderId || null} />
                  : visibleTab?.type === 'websocket'
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

          {/* 3. Right Sidebar (Intelligence) — collapsible */}
          {intelligenceCollapsed ? (
            <div className="w-10 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col items-center py-2 gap-2 shrink-0">
              <button
                onClick={toggleIntelligence}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition-colors"
                title="Expand Intelligence Panel"
              >
                <PanelRightOpen size={16} />
              </button>
              <div className="w-6 border-t border-slate-200 dark:border-slate-700" />
              <button
                onClick={toggleIntelligence}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-corporate-500 dark:text-corporate-400 transition-colors"
                title="AI Chat"
              >
                <MessageSquare size={14} />
              </button>
              <button
                onClick={toggleIntelligence}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors"
                title="Tests"
              >
                <FlaskConical size={14} />
              </button>
              <button
                onClick={toggleIntelligence}
                className="p-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 transition-colors"
                title="AI Intelligence"
              >
                <Sparkles size={14} />
              </button>
            </div>
          ) : (
            <>
              <ResizeHandle onResize={handleIntelligenceResize} />
              <div className="flex flex-col border-l border-slate-200 dark:border-slate-800 shrink-0" style={{ width: intelligenceWidth }} data-tour="intelligence-panel">
                <IntelligencePanel onCollapse={toggleIntelligence} />
              </div>
            </>
          )}
        </div>
      )}
      </Suspense>
      <ToastContainer />
      <UpgradeModal />
    </div>
  );
}

export default App;
