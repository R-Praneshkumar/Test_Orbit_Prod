import React, { useState, useMemo, useCallback } from 'react';
import {
    FlaskConical, Sparkles, FileSearch, History, Activity,
    ChevronDown, ChevronRight, Trash2, Play, Link2,
    CheckCircle, XCircle, AlertTriangle, Download,
    FolderOpen, Eye, RefreshCw, Plus, Check
} from 'lucide-react';
import { useWorkspaceStore, flattenItems, flattenItemsWithPath, groupTestsByFolder, findFolderById, matchTestToRequest } from '../../store/workspaceStore';
import { API_BASE, authFetch } from '../../config';
import { runLocalContractChecks } from '../../utils/contractEngine';

// ── Shared Constants ──────────────────────────────────────────────

const CATEGORY_COLORS = {
    happy_path: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800',
    edge_case: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    security: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    performance: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    validation: 'bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-900/20 dark:text-violet-400 dark:border-violet-800',
};

const METHOD_COLORS = {
    GET: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 dark:text-emerald-400',
    POST: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-400',
    PUT: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30 dark:text-blue-400',
    DELETE: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30 dark:text-rose-400',
    PATCH: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30 dark:text-violet-400',
};

const SUBTABS = [
    { key: 'suites', label: 'Suites', icon: FlaskConical },
    { key: 'suggest', label: 'AI Suggest', icon: Sparkles },
    { key: 'contract', label: 'Contract', icon: FileSearch },
    { key: 'history', label: 'History', icon: History },
];

// ── Main Component ────────────────────────────────────────────────

export const TestDashboard = ({ collectionId, folderId = null }) => {
    const [activeSubTab, setActiveSubTab] = useState('suites');
    const collections = useWorkspaceStore(state => state.collections);
    const collection = collections.find(c => c.id === collectionId);

    if (!collection) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <p className="text-sm">Collection not found</p>
            </div>
        );
    }

    // Resolve folder context when folderId is provided
    const folder = folderId ? findFolderById(collection.items, folderId) : null;
    if (folderId && !folder) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-500">
                <p className="text-sm">Folder no longer exists</p>
            </div>
        );
    }

    // Scope items: folder's items when in folder mode, full collection otherwise
    const scopedItems = folder ? folder.items : collection.items;
    const scopeLabel = folder ? folder.name : collection.name;

    return (
        <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="px-6 pt-5 pb-0">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-corporate-50 dark:bg-corporate-900/30 border border-corporate-200 dark:border-corporate-800 rounded-lg flex items-center justify-center">
                            <FlaskConical size={16} className="text-corporate-600 dark:text-corporate-400" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-tight">
                                {scopeLabel} Tests
                                {folder && (
                                    <span className="ml-2 text-[10px] font-normal text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-1.5 py-0.5 rounded-full">
                                        Folder
                                    </span>
                                )}
                            </h1>
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                {(collection.testSuites || []).length} suites &middot; {(collection.testSuites || []).reduce((sum, s) => sum + (s.tests?.length || 0), 0)} tests
                                {folder && <span> &middot; {flattenItems(scopedItems, 'request').length} endpoints in folder</span>}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Subtab bar */}
                <div className="flex gap-0 border-b border-slate-200 dark:border-slate-700">
                    {SUBTABS.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeSubTab === tab.key;
                        return (
                            <button
                                key={tab.key}
                                onClick={() => setActiveSubTab(tab.key)}
                                className={`flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${isActive
                                    ? 'border-corporate-600 text-corporate-700 dark:text-corporate-400'
                                    : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                <Icon size={13} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto">
                {activeSubTab === 'suites' && <SuitesTab collectionId={collectionId} collection={collection} folderId={folderId} scopedItems={scopedItems} scopeLabel={scopeLabel} />}
                {activeSubTab === 'suggest' && <SuggestTab collection={collection} scopedItems={scopedItems} />}
                {activeSubTab === 'contract' && <ContractTab collection={collection} scopedItems={scopedItems} />}
                {activeSubTab === 'history' && <HistoryTab collection={collection} folderId={folderId} />}
            </div>
        </div>
    );
};

// ── SUBTAB 1: Suites ──────────────────────────────────────────────

const SuitesTab = ({ collectionId, collection, folderId = null, scopedItems = null, scopeLabel = '' }) => {
    const [generating, setGenerating] = useState(false);
    const [testPrompt, setTestPrompt] = useState('');
    const [categoryFilter, setCategoryFilter] = useState(null);
    const [groupByFolder, setGroupByFolder] = useState(false);

    const addTestSuite = useWorkspaceStore(state => state.addTestSuite);
    const deleteTestSuite = useWorkspaceStore(state => state.deleteTestSuite);
    const openRunnerForTestSuite = useWorkspaceStore(state => state.openRunnerForTestSuite);
    const importTestsToCollection = useWorkspaceStore(state => state.importTestsToCollection);
    const autoLinkTestSuite = useWorkspaceStore(state => state.autoLinkTestSuite);

    // Use scoped items (folder's items when in folder mode)
    const items = scopedItems || collection.items;
    const allRequests = useMemo(() => flattenItems(items, 'request'), [items]);

    // When folderId is set, filter test suites to only show tests linked to folder's requests
    const scopedRequestIds = useMemo(() => {
        if (!folderId) return null;
        return new Set(allRequests.map(r => r.id));
    }, [folderId, allRequests]);

    const testSuites = useMemo(() => {
        const suites = collection.testSuites || [];
        if (!scopedRequestIds) return suites;
        // Filter each suite's tests to only those matching folder's requests
        return suites
            .map(suite => ({
                ...suite,
                tests: (suite.tests || []).filter(test => {
                    // Direct ID match
                    if (test.requestId && scopedRequestIds.has(test.requestId)) return true;
                    // Try signature matching against folder requests
                    const matched = matchTestToRequest(test, allRequests, collection.baseUrl || '');
                    return matched && scopedRequestIds.has(matched.id);
                })
            }))
            .filter(suite => suite.tests.length > 0);
    }, [collection.testSuites, scopedRequestIds, allRequests, collection.baseUrl]);

    const handleGenerate = async () => {
        if (!collectionId) return;
        setGenerating(true);
        try {
            const baseUrl = collection.baseUrl || allRequests[0]?.url || '';
            // Scope context: folder endpoints only when in folder mode
            const context = folderId
                ? `Collection: ${collection.name}, Folder: ${scopeLabel}, Endpoints: ${allRequests.map(i => `${i.method} ${i.url}`).join(', ')}`
                : `Collection: ${collection.name}, Endpoints: ${allRequests.map(i => `${i.method} ${i.url}`).join(', ')}`;
            const res = await authFetch(`${API_BASE}/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: baseUrl,
                    context,
                    openapi_spec: collection.openApiSpec || undefined,
                    user_instructions: testPrompt.trim() || undefined,
                    base_url: collection.baseUrl || undefined,
                })
            });
            const data = await res.json();
            if (!res.ok || data.error || data.detail) {
                alert(`Test generation failed: ${data.error || data.detail || 'Unknown error'}`);
            } else {
                addTestSuite(collectionId, data, folderId);
                setTestPrompt('');
            }
        } catch (e) {
            alert(`Failed to connect to AI service: ${e.message}`);
        } finally {
            setGenerating(false);
        }
    };

    // Collect all unique categories across suites
    const allCategories = useMemo(() => {
        const cats = new Set();
        for (const suite of testSuites) {
            for (const t of suite.tests || []) {
                if (t.category) cats.add(t.category);
            }
        }
        return [...cats];
    }, [testSuites]);

    return (
        <div className="p-6 space-y-4 max-w-4xl mx-auto">
            {/* Generate Section */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
                <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Generate Tests</span>
                    <button
                        onClick={handleGenerate}
                        disabled={generating}
                        className="text-xs font-bold bg-corporate-600 hover:bg-corporate-700 disabled:bg-corporate-300 text-white px-4 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                    >
                        {generating ? <Activity size={12} className="animate-spin" /> : <Sparkles size={12} />}
                        {generating ? 'Generating...' : 'Generate with AI'}
                    </button>
                </div>
                <textarea
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    className="w-full text-xs p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 dark:text-slate-200 resize-none outline-none focus:ring-2 focus:ring-corporate-500"
                    rows={2}
                    placeholder="Describe what tests you want... e.g. 'Test auth endpoints with invalid tokens, check required fields on POST /users'"
                />
            </div>

            {/* Filters */}
            {testSuites.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setGroupByFolder(!groupByFolder)}
                        className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors flex items-center gap-1 ${groupByFolder
                            ? 'bg-corporate-50 text-corporate-700 border-corporate-200 dark:bg-corporate-900/30 dark:text-corporate-400 dark:border-corporate-800'
                            : 'bg-white text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                            }`}
                    >
                        <FolderOpen size={10} /> Group by Folder
                    </button>
                    {allCategories.map(cat => (
                        <button
                            key={cat}
                            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
                            className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors ${categoryFilter === cat
                                ? CATEGORY_COLORS[cat] || 'bg-slate-100 text-slate-700 border-slate-300'
                                : 'bg-white text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
                                }`}
                        >
                            {cat.replace(/_/g, ' ')}
                        </button>
                    ))}
                </div>
            )}

            {/* Suite List */}
            {testSuites.length === 0 && !generating && (
                <div className="text-center py-12">
                    <FlaskConical size={36} className="mx-auto mb-3 text-slate-200 dark:text-slate-700" strokeWidth={1} />
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No test suites yet</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                        Use the generator above to create AI-powered test suites, or leave the prompt empty for comprehensive auto-generated tests.
                    </p>
                </div>
            )}

            {testSuites.map(suite => (
                <SuiteRow
                    key={suite.id}
                    suite={suite}
                    collection={collection}
                    allRequests={allRequests}
                    categoryFilter={categoryFilter}
                    groupByFolder={groupByFolder}
                    onDelete={() => deleteTestSuite(collectionId, suite.id)}
                    onRun={() => openRunnerForTestSuite(collectionId, suite)}
                    onImport={() => {
                        const result = importTestsToCollection(collectionId, suite.tests || []);
                        alert(`Imported ${result.imported} requests${result.skipped ? ` (${result.skipped} duplicates skipped)` : ''}`);
                    }}
                    onRelink={() => {
                        const result = autoLinkTestSuite(collectionId, suite.id);
                        alert(`Linked ${result.linked} tests (${result.unlinked} unlinked)`);
                    }}
                />
            ))}
        </div>
    );
};

// Individual suite row with expandable tests
const SuiteRow = ({ suite, collection, allRequests, categoryFilter, groupByFolder, onDelete, onRun, onImport, onRelink }) => {
    const [expanded, setExpanded] = useState(false);
    const tests = suite.tests || [];
    const lrs = suite.lastRunSummary;

    const linkedCount = tests.filter(t => t.requestId && allRequests.some(r => r.id === t.requestId)).length;
    const linkedPct = tests.length > 0 ? Math.round((linkedCount / tests.length) * 100) : 0;

    const filteredTests = categoryFilter ? tests.filter(t => t.category === categoryFilter) : tests;

    const groupedTests = useMemo(() => {
        if (!groupByFolder) return null;
        return groupTestsByFolder(filteredTests, collection.items, collection.baseUrl);
    }, [groupByFolder, filteredTests, collection.items, collection.baseUrl]);

    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            {/* Suite Header */}
            <div
                className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                onClick={() => setExpanded(!expanded)}
            >
                {expanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}

                <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{suite.test_suite_name || 'Test Suite'}</div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        <span>{tests.length} tests</span>
                        <span className={linkedPct === 100 ? 'text-green-600 dark:text-green-400' : linkedPct > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400'}>
                            {linkedPct}% linked
                        </span>
                        {lrs && (
                            <>
                                <span className="text-green-600 dark:text-green-400">{lrs.passed} passed</span>
                                {lrs.failed > 0 && <span className="text-red-600 dark:text-red-400">{lrs.failed} failed</span>}
                            </>
                        )}
                        {suite.source && <span className="italic">{suite.source}</span>}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                    <button onClick={onRelink} title="Re-link tests to requests" className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-400 hover:text-corporate-600 transition-colors">
                        <Link2 size={13} />
                    </button>
                    <button onClick={onRun} title="Run suite" className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-400 hover:text-green-600 transition-colors">
                        <Play size={13} />
                    </button>
                    <button onClick={onImport} title="Import as requests" className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-400 hover:text-blue-600 transition-colors">
                        <Download size={13} />
                    </button>
                    <button onClick={onDelete} title="Delete suite" className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {/* Expanded: test list */}
            {expanded && (
                <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    {groupByFolder && groupedTests ? (
                        // Grouped view
                        [...groupedTests.entries()].map(([folderName, folderTests]) => (
                            <div key={folderName}>
                                <div className="px-4 py-2 bg-slate-50/50 dark:bg-slate-800/50 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                    <FolderOpen size={10} /> {folderName}
                                </div>
                                {folderTests.map(test => (
                                    <TestRow key={test.id || test.name} test={test} allRequests={allRequests} />
                                ))}
                            </div>
                        ))
                    ) : (
                        // Flat view
                        filteredTests.map(test => (
                            <TestRow key={test.id || test.name} test={test} allRequests={allRequests} />
                        ))
                    )}
                    {filteredTests.length === 0 && (
                        <div className="text-center py-6 text-xs text-slate-400 dark:text-slate-500">
                            No tests match the current filter
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Single test row inside an expanded suite
const TestRow = ({ test, allRequests }) => {
    const linkedReq = test.requestId ? allRequests.find(r => r.id === test.requestId) : null;
    const catColor = CATEGORY_COLORS[test.category] || 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700';

    return (
        <div className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            {/* Method badge */}
            <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${METHOD_COLORS[(test.method || 'GET').toUpperCase()] || 'text-slate-500 bg-slate-100'}`}>
                {(test.method || 'GET').toUpperCase()}
            </span>

            {/* Test name + endpoint */}
            <div className="flex-1 min-w-0">
                <div className="text-xs text-slate-700 dark:text-slate-200 truncate">{test.name}</div>
                <div className="text-[10px] text-slate-400 dark:text-slate-500 truncate font-mono">{test.endpoint}</div>
            </div>

            {/* Category badge */}
            {test.category && (
                <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full border ${catColor}`}>
                    {test.category.replace(/_/g, ' ')}
                </span>
            )}

            {/* Link status */}
            {linkedReq ? (
                <span className="text-[9px] text-green-600 dark:text-green-400 flex items-center gap-0.5" title={`Linked to: ${linkedReq.name || linkedReq.url}`}>
                    <Link2 size={10} /> {(linkedReq.name || linkedReq.url || '').slice(0, 20)}
                </span>
            ) : (
                <span className="text-[9px] text-amber-500 dark:text-amber-400 flex items-center gap-0.5" title="Not linked to any request">
                    <AlertTriangle size={10} /> unlinked
                </span>
            )}

            {/* Last result indicator */}
            {test.lastResult && (
                test.lastResult === 'pass'
                    ? <CheckCircle size={12} className="text-green-500 shrink-0" />
                    : <XCircle size={12} className="text-red-500 shrink-0" />
            )}
        </div>
    );
};

// ── SUBTAB 2: AI Suggest ──────────────────────────────────────────

const SuggestTab = ({ collection, scopedItems = null }) => {
    const [selectedRequestId, setSelectedRequestId] = useState('');
    const [loading, setLoading] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [checkedIds, setCheckedIds] = useState(new Set());
    const [error, setError] = useState(null);

    const approveSuggestion = useWorkspaceStore(state => state.approveSuggestion);

    const items = scopedItems || collection.items;
    const requestsWithPath = useMemo(
        () => flattenItemsWithPath(items, 'request'),
        [items]
    );

    const selectedEntry = requestsWithPath.find(r => r.item.id === selectedRequestId);
    const selectedReq = selectedEntry?.item;

    const handleSuggest = async () => {
        if (!selectedReq) return;
        setLoading(true);
        setError(null);
        setSuggestions([]);
        try {
            const res = await authFetch(`${API_BASE}/suggest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    method: selectedReq.method || 'GET',
                    url: selectedReq.url || '',
                    endpoint_name: selectedReq.name || '',
                    existing_assertions: selectedReq.assertions || [],
                    openapi_spec: collection.openApiSpec || undefined,
                    base_url: collection.baseUrl || undefined,
                })
            });
            const data = await res.json();
            if (!res.ok || data.error || data.detail) {
                setError(data.error || data.detail || 'Failed to get suggestions');
            } else {
                const sugs = (data.suggestions || []).map((s, i) => ({ ...s, _id: `sug-${i}-${Date.now()}` }));
                setSuggestions(sugs);
                setCheckedIds(new Set(sugs.filter(s => s.confidence === 'high').map(s => s._id)));
            }
        } catch (e) {
            setError(`Connection failed: ${e.message}`);
        } finally {
            setLoading(false);
        }
    };

    const toggleCheck = (id) => {
        setCheckedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const handleAddSelected = () => {
        const selected = suggestions.filter(s => checkedIds.has(s._id));
        for (const sug of selected) {
            approveSuggestion(selectedRequestId, sug);
        }
        setSuggestions(prev => prev.filter(s => !checkedIds.has(s._id)));
        setCheckedIds(new Set());
    };

    const handleAddSingle = (sug) => {
        approveSuggestion(selectedRequestId, sug);
        setSuggestions(prev => prev.filter(s => s._id !== sug._id));
        setCheckedIds(prev => { const next = new Set(prev); next.delete(sug._id); return next; });
    };

    const checkedCount = checkedIds.size;
    const confidenceColors = {
        high: 'text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800',
        medium: 'text-amber-700 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800',
        low: 'text-slate-600 bg-slate-50 border-slate-200 dark:text-slate-400 dark:bg-slate-800 dark:border-slate-700',
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-4">
            {/* Endpoint picker */}
            <div className="flex items-center gap-3">
                <select
                    value={selectedRequestId}
                    onChange={e => { setSelectedRequestId(e.target.value); setSuggestions([]); setError(null); }}
                    className="flex-1 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 outline-none focus:ring-2 focus:ring-corporate-500 text-slate-700 dark:text-slate-200"
                >
                    <option value="">Select an endpoint...</option>
                    {requestsWithPath.map(({ item, folderPath }) => (
                        <option key={item.id} value={item.id}>
                            {folderPath.length > 0 ? `${folderPath.join(' / ')} / ` : ''}{(item.method || 'GET').toUpperCase()} {item.name || item.url}
                        </option>
                    ))}
                </select>
                <button
                    onClick={handleSuggest}
                    disabled={!selectedReq || loading}
                    className="text-xs font-bold bg-corporate-600 hover:bg-corporate-700 disabled:bg-corporate-300 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg flex items-center gap-1.5 transition-colors whitespace-nowrap"
                >
                    {loading ? <Activity size={12} className="animate-spin" /> : <Sparkles size={12} />}
                    {loading ? 'Analyzing...' : 'Suggest'}
                </button>
            </div>

            {/* Error */}
            {error && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    {error}
                </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                            Suggestions ({suggestions.length})
                        </span>
                        {checkedCount > 0 && (
                            <button
                                onClick={handleAddSelected}
                                className="text-[10px] font-bold bg-corporate-600 hover:bg-corporate-700 text-white px-3 py-1.5 rounded flex items-center gap-1 transition-colors"
                            >
                                <Plus size={10} /> Add Selected ({checkedCount})
                            </button>
                        )}
                    </div>

                    {/* Suggestion cards */}
                    {suggestions.map(sug => {
                        const isChecked = checkedIds.has(sug._id);
                        const confColor = confidenceColors[sug.confidence] || confidenceColors.low;
                        const catColor = CATEGORY_COLORS[sug.category] || CATEGORY_COLORS.happy_path;

                        return (
                            <div key={sug._id} className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-start gap-3">
                                    {/* Checkbox */}
                                    <button
                                        onClick={() => toggleCheck(sug._id)}
                                        className={`w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${isChecked
                                            ? 'border-corporate-500 bg-corporate-500 text-white'
                                            : 'border-slate-300 dark:border-slate-600'
                                            }`}
                                    >
                                        {isChecked && <Check size={10} />}
                                    </button>

                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border ${confColor}`}>
                                                {sug.confidence}
                                            </span>
                                            {sug.category && (
                                                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full border ${catColor}`}>
                                                    {sug.category.replace(/_/g, ' ')}
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200">{sug.name}</div>
                                        {sug.description && (
                                            <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">{sug.description}</div>
                                        )}
                                        {/* Assertions preview */}
                                        {sug.assertions?.length > 0 && (
                                            <div className="mt-2 space-y-1">
                                                {sug.assertions.map((a, i) => (
                                                    <div key={i} className="text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800 rounded px-2 py-1">
                                                        {a.type}: {a.target || ''} {a.comparison} {a.expected || ''}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={() => handleAddSingle(sug)}
                                        title="Add to request"
                                        className="text-[10px] font-medium text-corporate-600 dark:text-corporate-400 hover:text-corporate-700 px-2 py-1 rounded hover:bg-corporate-50 dark:hover:bg-corporate-900/20 transition-colors whitespace-nowrap"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Empty state */}
            {!loading && suggestions.length === 0 && !error && (
                <div className="text-center py-12">
                    <Sparkles size={36} className="mx-auto mb-3 text-slate-200 dark:text-slate-700" strokeWidth={1} />
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">AI-Powered Assertion Suggestions</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                        Select an endpoint above and click "Suggest" to get AI-recommended assertions. Review and approve before they're added.
                    </p>
                </div>
            )}
        </div>
    );
};

// ── SUBTAB 3: Contract Testing ────────────────────────────────────

const ContractTab = ({ collection, scopedItems = null }) => {
    const [results, setResults] = useState([]);
    const [running, setRunning] = useState(false);
    const [expandedPath, setExpandedPath] = useState(null);
    const [error, setError] = useState(null);

    const responses = useWorkspaceStore(state => state.responses);
    const localMode = useWorkspaceStore(state => state.localMode);
    const items = scopedItems || collection.items;

    // Parse spec
    const parsedSpec = useMemo(() => {
        try {
            if (!collection.openApiSpec) return null;
            const text = collection.openApiSpec.trim();
            if (text.startsWith('{')) return JSON.parse(text);
            const { default: yamlParse } = { default: (str) => { try { return JSON.parse(str); } catch { return null; } } };
            return yamlParse(text);
        } catch { return null; }
    }, [collection.openApiSpec]);

    const specEndpointCount = parsedSpec?.paths ? Object.keys(parsedSpec.paths).length : 0;

    // Run local contract checks using cached responses
    const handleLocalCheck = useCallback(() => {
        if (!parsedSpec?.paths) {
            setError('No valid OpenAPI spec loaded. Add one in the Spec tab of the Intelligence Panel.');
            return;
        }
        setRunning(true);
        setError(null);
        try {
            const allRequests = flattenItems(items, 'request');
            const localResults = runLocalContractChecks(parsedSpec, responses, allRequests, collection.baseUrl || '');
            setResults(localResults);
        } catch (e) {
            setError(`Contract check failed: ${e.message}`);
        } finally {
            setRunning(false);
        }
    }, [parsedSpec, items, collection.baseUrl, responses]);

    // Run server-side contract checks (makes actual API calls)
    const handleServerCheck = async () => {
        if (!collection.openApiSpec) {
            setError('No OpenAPI spec loaded.');
            return;
        }
        setRunning(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE}/contract-check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    openapi_spec: collection.openApiSpec,
                    base_url: collection.baseUrl || '',
                    local_mode: localMode,
                })
            });
            const data = await res.json();
            if (!res.ok || data.error || data.detail) {
                setError(data.error || data.detail || 'Contract check failed');
            } else {
                setResults(data.results || []);
            }
        } catch (e) {
            setError(`Connection failed: ${e.message}`);
        } finally {
            setRunning(false);
        }
    };

    const passCount = results.filter(r => r.status === 'pass').length;
    const driftCount = results.filter(r => r.status === 'drift').length;
    const skipCount = results.filter(r => r.status === 'skipped').length;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-4">
            {/* Header bar */}
            <div className="flex items-center justify-between">
                <div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">Contract Testing</span>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                        {parsedSpec ? `Spec loaded: ${specEndpointCount} endpoints` : 'No spec loaded'}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleLocalCheck}
                        disabled={running || !parsedSpec}
                        className="text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-700 dark:text-slate-200 px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                        title="Check cached responses against spec (no API calls)"
                    >
                        {running ? <Activity size={12} className="animate-spin" /> : <Eye size={12} />}
                        Check Cached
                    </button>
                    <button
                        onClick={handleServerCheck}
                        disabled={running || !collection.openApiSpec}
                        className="text-xs font-bold bg-corporate-600 hover:bg-corporate-700 disabled:bg-corporate-300 text-white px-3 py-2 rounded-lg flex items-center gap-1.5 transition-colors"
                        title="Make live API calls and compare against spec"
                    >
                        {running ? <Activity size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                        Live Check
                    </button>
                </div>
            </div>

            {error && (
                <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    {error}
                </div>
            )}

            {/* Summary badges */}
            {results.length > 0 && (
                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-2.5 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle size={10} /> {passCount} passed
                    </span>
                    {driftCount > 0 && (
                        <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-2.5 py-1 rounded-full flex items-center gap-1">
                            <AlertTriangle size={10} /> {driftCount} drift
                        </span>
                    )}
                    {skipCount > 0 && (
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2.5 py-1 rounded-full">
                            {skipCount} skipped
                        </span>
                    )}
                </div>
            )}

            {/* Results table */}
            {results.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    {/* Table header */}
                    <div className="grid grid-cols-[1fr_80px_60px_60px] gap-2 px-4 py-2 bg-slate-50 dark:bg-slate-800 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        <span>Endpoint</span>
                        <span className="text-center">Status</span>
                        <span className="text-center">Drifts</span>
                        <span className="text-center">Details</span>
                    </div>

                    {results.map((r, i) => {
                        const isExpanded = expandedPath === `${r.method}-${r.path}`;
                        return (
                            <div key={i}>
                                <div className="grid grid-cols-[1fr_80px_60px_60px] gap-2 px-4 py-2.5 border-t border-slate-100 dark:border-slate-800 items-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${METHOD_COLORS[r.method] || 'text-slate-500 bg-slate-100'}`}>
                                            {r.method}
                                        </span>
                                        <span className="text-xs text-slate-700 dark:text-slate-200 font-mono truncate">{r.path}</span>
                                    </div>
                                    <div className="text-center">
                                        {r.status === 'pass' && <CheckCircle size={14} className="inline text-green-500" />}
                                        {r.status === 'drift' && <AlertTriangle size={14} className="inline text-amber-500" />}
                                        {r.status === 'skipped' && <span className="text-[10px] text-slate-400">skipped</span>}
                                        {r.status === 'error' && <XCircle size={14} className="inline text-red-500" />}
                                    </div>
                                    <div className="text-center text-xs text-slate-600 dark:text-slate-300">
                                        {r.driftCount || 0}
                                    </div>
                                    <div className="text-center">
                                        {(r.drifts?.length > 0 || r.status === 'skipped') && (
                                            <button
                                                onClick={() => setExpandedPath(isExpanded ? null : `${r.method}-${r.path}`)}
                                                className="text-[10px] text-corporate-600 dark:text-corporate-400 hover:underline"
                                            >
                                                {isExpanded ? 'Hide' : 'View'}
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Expanded drift details */}
                                {isExpanded && r.drifts?.length > 0 && (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 px-4 py-3">
                                        <div className="grid grid-cols-[1fr_100px_100px_120px] gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                                            <span>Field</span>
                                            <span>Spec Type</span>
                                            <span>Actual</span>
                                            <span>Issue</span>
                                        </div>
                                        {r.drifts.map((d, di) => (
                                            <div key={di} className="grid grid-cols-[1fr_100px_100px_120px] gap-2 text-[10px] py-1.5 border-t border-slate-100 dark:border-slate-800 items-center">
                                                <span className="text-slate-700 dark:text-slate-200 font-mono truncate">{d.field}</span>
                                                <span className="text-slate-500">{d.specType}</span>
                                                <span className={d.issue === 'missing_required' ? 'text-red-500 italic' : 'text-slate-500'}>{d.actualType}</span>
                                                <span className={`font-medium ${d.severity === 'error' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                                                    {d.issue?.replace(/_/g, ' ')}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Skipped message */}
                                {isExpanded && r.status === 'skipped' && (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 px-4 py-3 text-[10px] text-slate-400 italic">
                                        {r.message || 'No cached response available. Run the request first.'}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Empty state */}
            {results.length === 0 && !running && !error && (
                <div className="text-center py-12">
                    <FileSearch size={36} className="mx-auto mb-3 text-slate-200 dark:text-slate-700" strokeWidth={1} />
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Schema Drift Detection</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 max-w-sm mx-auto">
                        Compare your API responses against the OpenAPI spec to find missing fields, type mismatches, and enum violations.
                    </p>
                    {!parsedSpec && (
                        <p className="text-xs text-amber-500 dark:text-amber-400 mt-3">
                            Load an OpenAPI spec in the Intelligence Panel first.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

// ── SUBTAB 4: History ─────────────────────────────────────────────

const HistoryTab = ({ collection, folderId = null }) => {
    const [expandedRun, setExpandedRun] = useState(null);
    const [filter, setFilter] = useState('all'); // all, pass, fail

    const runHistory = useMemo(() => {
        const history = collection.runHistory || [];
        if (!folderId) return history;
        return history.filter(run => run.folderId === folderId);
    }, [collection.runHistory, folderId]);

    // Sort newest first
    const sortedRuns = useMemo(() =>
        [...runHistory].sort((a, b) => new Date(b.startedAt || 0) - new Date(a.startedAt || 0)),
        [runHistory]
    );

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Run History ({runHistory.length})
                </span>
                {runHistory.length > 0 && (
                    <div className="flex items-center gap-1">
                        {['all', 'pass', 'fail'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`text-[10px] font-medium px-2.5 py-1 rounded-full transition-colors ${filter === f
                                    ? 'bg-corporate-50 text-corporate-700 dark:bg-corporate-900/30 dark:text-corporate-400'
                                    : 'text-slate-500 hover:text-slate-700 dark:text-slate-400'
                                    }`}
                            >
                                {f === 'all' ? 'All' : f === 'pass' ? 'Passed' : 'Failed'}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {sortedRuns.length === 0 && (
                <div className="text-center py-12">
                    <History size={36} className="mx-auto mb-3 text-slate-200 dark:text-slate-700" strokeWidth={1} />
                    <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">No runs yet</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Run a test suite or collection to see results here.
                    </p>
                </div>
            )}

            {sortedRuns.map((run, idx) => {
                const results = run.results || [];
                const passed = results.filter(r => r.pass).length;
                const failed = results.filter(r => !r.pass).length;
                const isExpanded = expandedRun === idx;

                // Apply filter
                if (filter === 'pass' && failed > 0) return null;
                if (filter === 'fail' && failed === 0) return null;

                return (
                    <div key={idx} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                        <div
                            className="flex items-center gap-3 px-4 py-3 bg-slate-50 dark:bg-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
                            onClick={() => setExpandedRun(isExpanded ? null : idx)}
                        >
                            {isExpanded ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}

                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                    {run.suiteName || run.name || `Run #${runHistory.length - idx}`}
                                </div>
                                <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                    <span>{run.startedAt ? new Date(run.startedAt).toLocaleString() : 'Unknown time'}</span>
                                    <span>{results.length} tests</span>
                                    {run.duration && <span>{run.duration}ms</span>}
                                </div>
                            </div>

                            <div className="flex items-center gap-2 text-[10px] font-bold">
                                <span className="text-green-600 dark:text-green-400 flex items-center gap-0.5">
                                    <CheckCircle size={11} /> {passed}
                                </span>
                                {failed > 0 && (
                                    <span className="text-red-600 dark:text-red-400 flex items-center gap-0.5">
                                        <XCircle size={11} /> {failed}
                                    </span>
                                )}
                            </div>
                        </div>

                        {isExpanded && results.length > 0 && (
                            <div className="border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                                {results.map((r, ri) => (
                                    <div key={ri} className="flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 dark:border-slate-800 last:border-0">
                                        {r.pass
                                            ? <CheckCircle size={12} className="text-green-500 shrink-0" />
                                            : <XCircle size={12} className="text-red-500 shrink-0" />
                                        }
                                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${METHOD_COLORS[(r.method || 'GET').toUpperCase()] || 'text-slate-500 bg-slate-100'}`}>
                                            {r.method || 'GET'}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-slate-700 dark:text-slate-200 truncate">{r.name || r.endpoint}</div>
                                        </div>
                                        <span className={`text-[10px] font-mono ${r.status >= 400 ? 'text-red-500' : 'text-green-500'}`}>
                                            {r.status || '-'}
                                        </span>
                                        {r.time != null && (
                                            <span className="text-[10px] text-slate-400">{r.time}ms</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};
