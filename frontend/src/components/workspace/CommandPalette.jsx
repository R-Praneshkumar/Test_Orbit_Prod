import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, ArrowRight, Folder, Globe, Sun, Moon, Wifi, WifiOff, PanelLeftOpen, PanelRightOpen, Home, Wrench, Server, Book, Settings, Play, FlaskConical, FileText, Plus, Command, Shield, Clock } from 'lucide-react';
import { useWorkspaceStore, flattenItems } from '../../store/workspaceStore';

const METHOD_COLORS = {
    GET: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/30',
    POST: 'text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/30',
    PUT: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/30',
    DELETE: 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-900/30',
    PATCH: 'text-violet-600 bg-violet-50 dark:text-violet-400 dark:bg-violet-900/30',
    WS: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/30',
};

/**
 * Simple fuzzy match: checks if all characters in query appear in target in order.
 * Returns a score (lower = better match), or -1 if no match.
 */
function fuzzyMatch(query, target) {
    const q = query.toLowerCase();
    const t = target.toLowerCase();

    // Exact substring match gets best score
    const subIdx = t.indexOf(q);
    if (subIdx !== -1) return subIdx === 0 ? 0 : 1;

    // Fuzzy: all query chars must appear in order
    let qi = 0;
    let gaps = 0;
    let lastMatch = -1;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) {
            if (lastMatch >= 0 && ti - lastMatch > 1) gaps++;
            lastMatch = ti;
            qi++;
        }
    }
    return qi === q.length ? 2 + gaps : -1;
}

export function CommandPalette() {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef(null);
    const listRef = useRef(null);

    const collections = useWorkspaceStore(state => state.collections);
    const openTab = useWorkspaceStore(state => state.openTab);
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);
    const setActiveCollection = useWorkspaceStore(state => state.setActiveCollection);
    const toggleDarkMode = useWorkspaceStore(state => state.toggleDarkMode);
    const toggleLocalMode = useWorkspaceStore(state => state.toggleLocalMode);
    const toggleSidebar = useWorkspaceStore(state => state.toggleSidebar);
    const toggleIntelligence = useWorkspaceStore(state => state.toggleIntelligence);
    const darkMode = useWorkspaceStore(state => state.darkMode);
    const localMode = useWorkspaceStore(state => state.localMode);

    // Ctrl+K / Cmd+K to toggle
    useEffect(() => {
        const handler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setOpen(prev => {
                    if (!prev) {
                        setQuery('');
                        setSelectedIndex(0);
                    }
                    return !prev;
                });
            }
        };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, []);

    // Focus input when opened
    useEffect(() => {
        if (open) {
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    }, [open]);

    // Build searchable items
    const allItems = useMemo(() => {
        const items = [];

        // 1. Requests from all collections
        for (const col of collections) {
            const requests = flattenItems(col.items, 'request');
            const websockets = flattenItems(col.items, 'websocket');
            for (const req of [...requests, ...websockets]) {
                items.push({
                    id: `req-${req.id}`,
                    type: 'request',
                    name: req.name || 'Untitled',
                    method: req.type === 'websocket' ? 'WS' : (req.method || 'GET'),
                    url: req.url || '',
                    subtitle: col.name,
                    action: () => {
                        openTab({ ...req, collectionId: col.id });
                        setCurrentView('workspace');
                    },
                });
            }
        }

        // 2. Collections
        for (const col of collections) {
            items.push({
                id: `col-${col.id}`,
                type: 'collection',
                name: col.name,
                icon: Folder,
                subtitle: `${flattenItems(col.items, 'request').length} requests`,
                action: () => {
                    setActiveCollection(col.id);
                    setCurrentView('workspace');
                },
            });
        }

        // 3. Navigation actions
        const navActions = [
            { name: 'Go to Dashboard', icon: Home, subtitle: 'Navigation', action: () => setCurrentView('dashboard') },
            { name: 'Go to Workspace', icon: Wrench, subtitle: 'Navigation', action: () => setCurrentView('workspace') },
            { name: 'Go to Mock Server', icon: Server, subtitle: 'Navigation', action: () => setCurrentView('mock-server') },
            { name: 'Go to Docs', icon: Book, subtitle: 'Navigation', action: () => setCurrentView('docs') },
            { name: 'Go to Settings', icon: Settings, subtitle: 'Navigation', action: () => setCurrentView('profile') },
            { name: 'Go to Request History', icon: Clock, subtitle: 'Navigation', action: () => setCurrentView('history') },
            { name: 'Go to Admin Dashboard', icon: Shield, subtitle: 'Navigation', action: () => setCurrentView('admin') },
            { name: 'Postman Alternative', icon: Globe, subtitle: 'Compare', action: () => setCurrentView('postman-alternative') },
            { name: 'TestOrbit vs Postman', icon: Globe, subtitle: 'Compare', action: () => setCurrentView('postman-vs-testorbit') },
            { name: 'Migrate from Postman', icon: Globe, subtitle: 'Guide', action: () => setCurrentView('migrate-from-postman') },
        ];
        for (const nav of navActions) {
            items.push({ id: `nav-${nav.name}`, type: 'action', ...nav });
        }

        // 4. Quick actions
        const quickActions = [
            { name: `Toggle Dark Mode (currently ${darkMode ? 'on' : 'off'})`, icon: darkMode ? Sun : Moon, subtitle: 'Action', action: () => toggleDarkMode() },
            { name: `Toggle ${localMode ? 'Cloud' : 'Local'} Mode`, icon: localMode ? WifiOff : Wifi, subtitle: 'Action', action: () => toggleLocalMode() },
            { name: 'Toggle Sidebar', icon: PanelLeftOpen, subtitle: 'Action', action: () => toggleSidebar() },
            { name: 'Toggle Intelligence Panel', icon: PanelRightOpen, subtitle: 'Action', action: () => toggleIntelligence() },
        ];

        // Collection-specific actions
        for (const col of collections) {
            quickActions.push({
                name: `Run Collection: ${col.name}`,
                icon: Play,
                subtitle: 'Run',
                action: () => {
                    useWorkspaceStore.getState().openRunner(col.id);
                    setCurrentView('workspace');
                },
            });
            quickActions.push({
                name: `Collection Settings: ${col.name}`,
                icon: Settings,
                subtitle: 'Settings',
                action: () => {
                    useWorkspaceStore.getState().openCollectionSettings(col.id);
                    setCurrentView('workspace');
                },
            });
            quickActions.push({
                name: `Test Dashboard: ${col.name}`,
                icon: FlaskConical,
                subtitle: 'Tests',
                action: () => {
                    useWorkspaceStore.getState().openTestDashboard(col.id);
                    setCurrentView('workspace');
                },
            });
            quickActions.push({
                name: `New Request in ${col.name}`,
                icon: Plus,
                subtitle: 'Create',
                action: () => {
                    useWorkspaceStore.getState().addRequest(col.id);
                    setCurrentView('workspace');
                },
            });
        }

        for (const qa of quickActions) {
            items.push({ id: `action-${qa.name}`, type: 'action', ...qa });
        }

        return items;
    }, [collections, darkMode, localMode, openTab, setCurrentView, setActiveCollection, toggleDarkMode, toggleLocalMode, toggleSidebar, toggleIntelligence]);

    // Filter and sort by fuzzy match
    const filtered = useMemo(() => {
        if (!query.trim()) {
            // Show requests first, then collections, then actions — limited
            const reqs = allItems.filter(i => i.type === 'request').slice(0, 8);
            const cols = allItems.filter(i => i.type === 'collection').slice(0, 4);
            const acts = allItems.filter(i => i.type === 'action').slice(0, 6);
            return [...reqs, ...cols, ...acts];
        }
        const scored = [];
        for (const item of allItems) {
            // Match against name, URL (for requests), and subtitle
            const nameScore = fuzzyMatch(query, item.name);
            const urlScore = item.url ? fuzzyMatch(query, item.url) : -1;
            const subScore = item.subtitle ? fuzzyMatch(query, item.subtitle) : -1;
            const best = Math.min(
                ...[nameScore, urlScore, subScore].filter(s => s >= 0)
            );
            if (isFinite(best) && best >= 0) {
                scored.push({ ...item, _score: best });
            }
        }
        scored.sort((a, b) => a._score - b._score);
        return scored.slice(0, 20);
    }, [query, allItems]);

    // Scroll selected item into view
    useEffect(() => {
        if (!listRef.current) return;
        const el = listRef.current.children[selectedIndex];
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    const executeItem = useCallback((item) => {
        item.action();
        setOpen(false);
    }, []);

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (filtered[selectedIndex]) executeItem(filtered[selectedIndex]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setOpen(false);
        }
    };

    if (!open) return null;

    // Group items by type for section headers
    let lastType = null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={() => setOpen(false)}>
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm" />

            {/* Palette */}
            <div
                className="relative w-full max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-fade-in"
                onClick={e => e.stopPropagation()}
                role="dialog"
                aria-label="Command palette"
            >
                {/* Search Input */}
                <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200 dark:border-slate-700">
                    <Search size={16} className="text-slate-400 dark:text-slate-500 shrink-0" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={e => { setQuery(e.target.value); setSelectedIndex(0); }}
                        onKeyDown={handleKeyDown}
                        className="flex-1 bg-transparent text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none"
                        placeholder="Search requests, collections, actions..."
                    />
                    <kbd className="text-[10px] font-mono text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">ESC</kbd>
                </div>

                {/* Results */}
                <div ref={listRef} className="max-h-80 overflow-y-auto py-1" aria-live="polite">
                    {filtered.length === 0 && (
                        <div className="px-4 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                            No results for &ldquo;{query}&rdquo;
                        </div>
                    )}
                    {filtered.map((item, idx) => {
                        // Section header
                        let sectionHeader = null;
                        const typeLabel = item.type === 'request' ? 'Requests' : item.type === 'collection' ? 'Collections' : 'Actions';
                        if (item.type !== lastType) {
                            lastType = item.type;
                            sectionHeader = (
                                <div className="px-4 pt-2 pb-1 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                    {typeLabel}
                                </div>
                            );
                        }

                        const isSelected = idx === selectedIndex;
                        const Icon = item.icon || FileText;

                        return (
                            <React.Fragment key={item.id}>
                                {sectionHeader}
                                <button
                                    className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                                        isSelected
                                            ? 'bg-corporate-50 dark:bg-corporate-900/30 text-slate-800 dark:text-slate-100'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                    }`}
                                    onClick={() => executeItem(item)}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                >
                                    {item.type === 'request' ? (
                                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded w-9 text-center shrink-0 ${METHOD_COLORS[item.method] || 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800'}`}>
                                            {item.method}
                                        </span>
                                    ) : (
                                        <Icon size={14} className="text-slate-400 dark:text-slate-500 shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="text-xs font-medium truncate">{item.name}</div>
                                        {item.url && (
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate">{item.url}</div>
                                        )}
                                    </div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">{item.subtitle}</span>
                                    {isSelected && <ArrowRight size={12} className="text-corporate-500 shrink-0" />}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>

                {/* Footer */}
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-4 text-[10px] text-slate-400 dark:text-slate-500">
                    <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">&uarr;&darr;</kbd> Navigate</span>
                    <span className="flex items-center gap-1"><kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">&crarr;</kbd> Select</span>
                    <span className="flex items-center gap-1 ml-auto"><Command size={9} /> <kbd className="font-mono bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">K</kbd> Toggle</span>
                </div>
            </div>
        </div>
    );
}

export default CommandPalette;
