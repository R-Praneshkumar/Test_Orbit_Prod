import React from 'react';
import { X, Settings, FlaskConical } from 'lucide-react';
import { useWorkspaceStore, flattenItems } from '../../store/workspaceStore';

const METHOD_COLORS = {
    GET: 'text-emerald-600',
    POST: 'text-amber-600',
    PUT: 'text-blue-600',
    DELETE: 'text-rose-600',
    PATCH: 'text-violet-600',
};

export const TabManager = () => {
    const activeTabs = useWorkspaceStore(state => state.activeTabs);
    const activeTabId = useWorkspaceStore(state => state.activeTabId);
    const activeCollectionId = useWorkspaceStore(state => state.activeCollectionId);
    const collections = useWorkspaceStore(state => state.collections);
    const setActiveTab = useWorkspaceStore(state => state.setActiveTab);
    const closeTab = useWorkspaceStore(state => state.closeTab);

    // Filter tabs to only show those belonging to the active collection
    const filteredTabs = activeTabs.filter(tab => {
        if (tab.collectionId) return tab.collectionId === activeCollectionId;
        // Legacy tabs without collectionId: check if request exists in the active collection
        const col = collections.find(c => c.id === activeCollectionId);
        if (col) return flattenItems(col.items).some(i => i.id === tab.id);
        return true; // fallback: show all if no collection selected
    });

    const activeCol = collections.find(c => c.id === activeCollectionId);

    return (
        <div className="h-9 bg-slate-100 dark:bg-slate-800 flex items-end overflow-x-auto no-scrollbar border-b border-slate-200 dark:border-slate-700" role="tablist" aria-label="Open requests">
            {/* Collection indicator */}
            {activeCol && (
                <div className="flex items-center gap-1.5 px-3 py-2 text-[10px] text-slate-400 dark:text-slate-500 font-medium uppercase tracking-wider shrink-0 border-r border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    {activeCol.name}
                </div>
            )}

            {filteredTabs.map(tab => (
                <div
                    key={tab.id}
                    className={`
            group flex items-center gap-2 px-4 py-2 text-xs font-medium min-w-[140px] max-w-[240px] cursor-pointer select-none border-r border-slate-200 dark:border-slate-700 relative
            ${activeTabId === tab.id
                            ? 'bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 before:absolute before:top-0 before:left-0 before:right-0 before:h-[2px] before:bg-corporate-600'
                            : 'bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                        }
          `}
                    onClick={() => setActiveTab(tab.id)}
                    role="tab"
                    aria-selected={activeTabId === tab.id}
                >
                    {tab.type === 'collection-settings' ? (
                        <Settings size={12} className="text-slate-500 dark:text-slate-400 shrink-0" />
                    ) : tab.type === 'test-dashboard' ? (
                        <FlaskConical size={12} className="text-corporate-500 dark:text-corporate-400 shrink-0" />
                    ) : (
                        <span className={`font-bold tracking-tight uppercase text-[10px] ${tab.type === 'websocket' ? 'text-violet-600' : METHOD_COLORS[tab.method] || 'text-slate-500'}`}>
                            {tab.type === 'websocket' ? 'WS' : tab.method}
                        </span>
                    )}

                    <span className="truncate flex-1 font-sans">{tab.name}</span>

                    <button
                        onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
                        className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 p-0.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-500 dark:text-slate-400"
                        aria-label={`Close ${tab.name}`}
                    >
                        <X size={12} />
                    </button>
                </div>
            ))}

            {filteredTabs.length === 0 && (
                <div className="px-4 py-2 text-[10px] text-slate-400 dark:text-slate-500">
                    No open tabs in this collection
                </div>
            )}
        </div>
    );
};
