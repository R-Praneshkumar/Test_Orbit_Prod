import React, { useState, useMemo } from 'react';
import { Folder, Play, FlaskConical, CheckCircle, XCircle, Plus, Terminal, Upload, Clock, ArrowRight, Zap, FileText } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { CurlImportModal } from './CurlImportModal';
import { ImportCollectionModal } from './ImportCollectionModal';

export const Dashboard = () => {
    const collections = useWorkspaceStore(state => state.collections);
    const setActiveCollection = useWorkspaceStore(state => state.setActiveCollection);
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);
    const addCollection = useWorkspaceStore(state => state.addCollection);
    const [showCurlImport, setShowCurlImport] = useState(false);
    const [showCollectionImport, setShowCollectionImport] = useState(false);

    const handleOpenCollection = (colId) => {
        setActiveCollection(colId);
        setCurrentView('workspace');
    };

    const handleNewCollection = () => {
        const name = prompt('Collection name:');
        if (name?.trim()) {
            addCollection(name.trim());
        }
    };

    const getLastRunStats = (col) => {
        const runs = col.runHistory || [];
        if (runs.length === 0) return null;
        const last = runs[0];
        return last;
    };

    const getAllRecentRuns = () => {
        const allRuns = [];
        collections.forEach(col => {
            (col.runHistory || []).forEach(run => {
                allRuns.push({ ...run, collectionName: col.name, collectionId: col.id });
            });
        });
        return allRuns.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(0, 5);
    };

    const recentRuns = getAllRecentRuns();

    // eslint-disable-next-line react-hooks/purity
    const now = useMemo(() => Date.now(), []);
    const formatTimeAgo = (ts) => {
        if (!ts) return '';
        const diff = now - ts;
        if (diff < 60000) return 'just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return `${Math.floor(diff / 86400000)}d ago`;
    };

    return (
        <div className="flex-1 overflow-auto bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-8">
            <div className="max-w-5xl mx-auto">
                {/* Hero Section */}
                <div className="mb-8">
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                        Welcome to TestOrbit
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        {collections.length} collection{collections.length !== 1 ? 's' : ''} &middot; AI-powered API testing
                    </p>
                </div>

                {/* Quick Actions */}
                <div className="flex gap-3 mb-8">
                    <button
                        onClick={handleNewCollection}
                        className="flex items-center gap-2 px-4 py-2.5 bg-corporate-600 hover:bg-corporate-700 text-white text-sm font-semibold rounded-lg shadow-md shadow-corporate-200 dark:shadow-none transition-all active:scale-95"
                    >
                        <Plus size={16} />
                        New Collection
                    </button>
                    <button
                        onClick={() => setShowCurlImport(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-all active:scale-95"
                    >
                        <Terminal size={16} />
                        Import cURL
                    </button>
                    <button
                        onClick={() => setShowCollectionImport(true)}
                        className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium rounded-lg transition-all active:scale-95"
                    >
                        <Upload size={16} />
                        Import Collection
                    </button>
                </div>

                {/* Collections Grid */}
                <div className="mb-8">
                    <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Collections</h2>
                    {collections.length === 0 ? (
                        <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
                            <Folder size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" strokeWidth={1} />
                            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No collections yet</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Create your first collection to get started</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {collections.map(col => {
                                const itemCount = (col.items || []).filter(i => i.type === 'request').length;
                                const testCount = (col.testSuites || []).length;
                                const lastRun = getLastRunStats(col);

                                return (
                                    <div
                                        key={col.id}
                                        onClick={() => handleOpenCollection(col.id)}
                                        className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-5 cursor-pointer hover:shadow-lg hover:border-corporate-300 dark:hover:border-corporate-600 hover:-translate-y-0.5 transition-all duration-200"
                                    >
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex items-center gap-2.5">
                                                <div className="w-9 h-9 bg-corporate-50 dark:bg-corporate-900/30 border border-corporate-200 dark:border-corporate-700 rounded-lg flex items-center justify-center">
                                                    <Folder size={18} className="text-corporate-600 dark:text-corporate-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-corporate-600 dark:group-hover:text-corporate-400 transition-colors">
                                                        {col.name}
                                                    </h3>
                                                </div>
                                            </div>
                                            <ArrowRight size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-corporate-500 transition-colors mt-1" />
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <FileText size={12} />
                                                {itemCount} request{itemCount !== 1 ? 's' : ''}
                                            </span>
                                            {testCount > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <FlaskConical size={12} />
                                                    {testCount} test{testCount !== 1 ? 's' : ''}
                                                </span>
                                            )}
                                        </div>

                                        {lastRun && (
                                            <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <span className="text-slate-400 dark:text-slate-500">Last run</span>
                                                    <div className="flex items-center gap-2">
                                                        {lastRun.passed !== undefined && (
                                                            <span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
                                                                <CheckCircle size={10} /> {lastRun.passed}
                                                            </span>
                                                        )}
                                                        {lastRun.failed !== undefined && lastRun.failed > 0 && (
                                                            <span className="flex items-center gap-0.5 text-red-500 dark:text-red-400">
                                                                <XCircle size={10} /> {lastRun.failed}
                                                            </span>
                                                        )}
                                                        <span className="text-slate-400 dark:text-slate-500">
                                                            {formatTimeAgo(lastRun.timestamp)}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Add Collection Card */}
                            <div
                                onClick={handleNewCollection}
                                className="bg-slate-50 dark:bg-slate-800/50 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl p-5 cursor-pointer hover:border-corporate-400 dark:hover:border-corporate-600 hover:bg-corporate-50/30 dark:hover:bg-corporate-900/10 transition-all flex flex-col items-center justify-center min-h-[140px]"
                            >
                                <Plus size={24} className="text-slate-300 dark:text-slate-600 mb-2" />
                                <span className="text-xs font-medium text-slate-400 dark:text-slate-500">New Collection</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                {recentRuns.length > 0 && (
                    <div>
                        <h2 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-4">Recent Activity</h2>
                        <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                            {recentRuns.map((run, idx) => (
                                <div
                                    key={run.id || idx}
                                    onClick={() => handleOpenCollection(run.collectionId)}
                                    className={`flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${idx < recentRuns.length - 1 ? 'border-b border-slate-100 dark:border-slate-700' : ''
                                        }`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-2 h-2 rounded-full ${run.failed > 0 ? 'bg-amber-400' : 'bg-green-400'
                                            }`} />
                                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{run.collectionName}</span>
                                    </div>
                                    <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                                        {run.passed !== undefined && (
                                            <span className="text-green-600 dark:text-green-400">{run.passed} passed</span>
                                        )}
                                        {run.failed > 0 && (
                                            <span className="text-red-500 dark:text-red-400">{run.failed} failed</span>
                                        )}
                                        <span className="flex items-center gap-1 text-slate-400">
                                            <Clock size={10} />
                                            {formatTimeAgo(run.timestamp)}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Modals */}
            {showCurlImport && <CurlImportModal onClose={() => setShowCurlImport(false)} />}
            {showCollectionImport && <ImportCollectionModal onClose={() => setShowCollectionImport(false)} />}
        </div>
    );
};
