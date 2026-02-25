import React, { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, MoreHorizontal, Plus, Search, Pencil, Copy, Trash2, FilePlus, FolderPlus, Play, History, CheckCircle, XCircle, Globe, Download, Clock, FlaskConical, Terminal, Plug, Upload, PanelLeftClose } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { EnvironmentManager } from './EnvironmentManager';
import { CurlImportModal } from './CurlImportModal';
import { ImportCollectionModal } from './ImportCollectionModal';
import ShareModal from './ShareModal';
import { Users } from 'lucide-react';

import { API_BASE, authFetch } from '../../config';

const SidebarItem = ({ item, level = 0 }) => {
    const [expanded, setExpanded] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(item.name);
    const [showShareModal, setShowShareModal] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const menuRef = useRef(null);
    const renameRef = useRef(null);

    const openTab = useWorkspaceStore(state => state.openTab);
    const deleteRequest = useWorkspaceStore(state => state.deleteRequest);
    const renameItem = useWorkspaceStore(state => state.renameItem);
    const duplicateRequest = useWorkspaceStore(state => state.duplicateRequest);
    const openRunner = useWorkspaceStore(state => state.openRunner);
    const setActiveCollection = useWorkspaceStore(state => state.setActiveCollection);
    const activeCollectionId = useWorkspaceStore(state => state.activeCollectionId);
    const addTestSuite = useWorkspaceStore(state => state.addTestSuite);
    const collections = useWorkspaceStore(state => state.collections);
    const addRequestToFolder = useWorkspaceStore(state => state.addRequestToFolder);
    const moveItemToFolder = useWorkspaceStore(state => state.moveItemToFolder);
    const [showMoveMenu, setShowMoveMenu] = useState(false);

    // Close context menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setShowMenu(false);
            }
        };
        if (showMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showMenu]);

    // Focus rename input when entering rename mode
    useEffect(() => {
        if (isRenaming && renameRef.current) {
            renameRef.current.focus();
            renameRef.current.select();
        }
    }, [isRenaming]);

    const handleClick = () => {
        if (isRenaming) return;
        if (item.type === 'collection') {
            setExpanded(!expanded);
            setActiveCollection(item.id);
        } else if (item.type === 'folder') {
            setExpanded(!expanded);
        } else {
            // Works for both 'request' and 'websocket' types
            openTab(item);
        }
    };

    const handleRenameSubmit = () => {
        const trimmed = renameValue.trim();
        if (trimmed && trimmed !== item.name) {
            renameItem(item.id, trimmed);
        }
        setIsRenaming(false);
    };

    const handleMenuAction = (action) => {
        setShowMenu(false);
        switch (action) {
            case 'rename':
                setRenameValue(item.name);
                setIsRenaming(true);
                break;
            case 'share':
                if (item.type === 'collection') setShowShareModal(true);
                break;
            case 'duplicate':
                if (item.type === 'request') duplicateRequest(item.id);
                break;
            case 'delete':
                if (item.type === 'collection') {
                    setShowDeleteConfirm(true);
                } else {
                    deleteRequest(item.id);
                }
                break;
            case 'runAll':
                if (item.type === 'collection' && openRunner) openRunner(item.id);
                break;
            case 'generateTests':
                if (item.type === 'collection') {
                    (async () => {
                        const col = collections.find(c => c.id === item.id);
                        const colBaseUrl = col?.baseUrl || col?.items?.[0]?.url || '';
                        const openApiSpec = col?.openApiSpec || '';
                        const endpointList = (col?.items || []).map(i => `${i.method} ${i.url}`).join(', ');
                        try {
                            const res = await authFetch(`${API_BASE}/generate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    url: colBaseUrl,
                                    context: `Collection: ${col?.name}, Endpoints: ${endpointList}`,
                                    openapi_spec: openApiSpec || undefined,
                                    base_url: col?.baseUrl || undefined,
                                })
                            });
                            const data = await res.json();
                            const errMsg = data.error || data.detail;
                            if (!res.ok || errMsg) {
                                alert(`Failed to generate tests: ${errMsg || 'Unknown error'}`);
                            } else {
                                addTestSuite(item.id, data);
                            }
                        } catch (err) {
                            alert(`Failed to generate tests: ${err.message}`);
                        }
                    })();
                }
                break;
            case 'export':
                if (item.type === 'collection') {
                    // Export as Postman v2.1 collection
                    const postmanCol = {
                        info: {
                            name: item.name,
                            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
                        },
                        item: (item.items || []).filter(i => i.type === 'request').map(req => ({
                            name: req.name,
                            request: {
                                method: req.method,
                                header: (req.headers || []).filter(h => h.enabled !== false && h.key).map(h => ({
                                    key: h.key, value: h.value, type: 'text'
                                })),
                                url: { raw: req.url },
                                body: req.body?.content ? {
                                    mode: 'raw',
                                    raw: req.body.content,
                                    options: { raw: { language: 'json' } }
                                } : undefined
                            }
                        }))
                    };
                    const blob = new Blob([JSON.stringify(postmanCol, null, 2)], { type: 'application/json' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${item.name.replace(/\s+/g, '_')}_postman.json`;
                    a.click();
                    URL.revokeObjectURL(url);
                }
                break;
        }
    };

    const getIcon = () => {
        if (item.type === 'collection') return expanded ? <FolderOpen size={14} className="text-slate-800 dark:text-slate-200" /> : <Folder size={14} className="text-slate-800 dark:text-slate-200" />;
        if (item.type === 'folder') return expanded ? <FolderOpen size={14} className="text-slate-400 dark:text-slate-500" /> : <Folder size={14} className="text-slate-400 dark:text-slate-500" />;
        if (item.type === 'websocket') return (
            <span className="text-[9px] font-bold px-1 py-0.5 rounded border text-violet-600 bg-violet-50 border-violet-200 dark:bg-violet-900/30 dark:border-violet-700">
                WS
            </span>
        );

        const methodColors = {
            GET: 'text-emerald-600 bg-emerald-50 border-emerald-200 dark:bg-emerald-900/30 dark:border-emerald-700',
            POST: 'text-amber-600 bg-amber-50 border-amber-200 dark:bg-amber-900/30 dark:border-amber-700',
            PUT: 'text-blue-600 bg-blue-50 border-blue-200 dark:bg-blue-900/30 dark:border-blue-700',
            DELETE: 'text-rose-600 bg-rose-50 border-rose-200 dark:bg-rose-900/30 dark:border-rose-700',
            PATCH: 'text-violet-600 bg-violet-50 border-violet-200 dark:bg-violet-900/30 dark:border-violet-700'
        };

        return (
            <span className={`text-[9px] font-bold px-1 py-0.5 rounded border ${methodColors[item.method] || 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800'}`}>
                {item.method}
            </span>
        );
    };

    return (
        <div className="select-none font-sans">
            <div
                className={`
                    group flex items-center gap-2 px-3 py-1.5 cursor-pointer text-sm transition-colors border-l-2
                    ${item.type === 'collection' && item.id === activeCollectionId
                        ? 'border-l-[3px] border-corporate-500 bg-corporate-100 dark:bg-corporate-900/30 text-slate-900 dark:text-slate-100 font-semibold'
                        : `border-transparent ${level === 0 ? 'text-slate-800 dark:text-slate-100 font-medium' : 'text-slate-600 dark:text-slate-400'} hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-slate-300 dark:hover:border-slate-600`
                    }
                `}
                style={{ paddingLeft: `${level * 12 + 12}px` }}
                onClick={handleClick}
            >
                <span className="text-slate-400 dark:text-slate-500 shrink-0 w-4 block">
                    {(item.type === 'collection' || item.type === 'folder') && (
                        expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
                    )}
                </span>

                <div className="shrink-0 w-8 text-center flex justify-center">
                    {getIcon()}
                </div>

                {/* Inline Rename Input */}
                {isRenaming ? (
                    <input
                        ref={renameRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={handleRenameSubmit}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSubmit();
                            if (e.key === 'Escape') setIsRenaming(false);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-xs bg-white dark:bg-slate-800 border border-corporate-500 rounded px-1.5 py-0.5 outline-none text-slate-700 dark:text-slate-200 min-w-0"
                    />
                ) : (
                    <span className="truncate flex-1 flex items-center gap-1.5">
                        {item.name}
                        {item.type === 'collection' && (item.testSuites || []).length > 0 && (
                            <span className="text-[8px] bg-corporate-100 dark:bg-corporate-900/30 text-corporate-600 dark:text-corporate-400 px-1 py-0.5 rounded-full shrink-0">
                                {item.testSuites.length} tests
                            </span>
                        )}
                    </span>
                )}

                {/* Context Menu Trigger */}
                <div className="relative" ref={menuRef}>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-200 dark:hover:bg-slate-600 rounded text-slate-400 dark:text-slate-500"
                    >
                        <MoreHorizontal size={12} />
                    </button>

                    {/* Dropdown Menu */}
                    {showMenu && (
                        <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-lg overflow-hidden z-50">
                            {item.type === 'collection' && (item.items || []).length > 0 && (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleMenuAction('runAll'); }}
                                        className="w-full text-left px-3 py-2 text-xs text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2"
                                    >
                                        <Play size={11} className="fill-current" /> Run All
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleMenuAction('generateTests'); }}
                                        className="w-full text-left px-3 py-2 text-xs text-corporate-600 dark:text-corporate-400 hover:bg-corporate-50 dark:hover:bg-corporate-900/20 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800"
                                    >
                                        <FlaskConical size={11} /> Generate Tests
                                    </button>
                                </>
                            )}

                            <button
                                onClick={(e) => { e.stopPropagation(); handleMenuAction('rename'); }}
                                className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                            >
                                <Pencil size={11} /> Rename
                            </button>
                            {item.type === 'collection' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleMenuAction('share'); }}
                                    className="w-full text-left px-3 py-2 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center gap-2"
                                >
                                    <Users size={11} /> Share
                                </button>
                            )}
                            {item.type === 'request' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleMenuAction('duplicate'); }}
                                    className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                >
                                    <Copy size={11} /> Duplicate
                                </button>
                            )}
                            {item.type === 'folder' && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setShowMenu(false);
                                        const col = collections.find(c => c.id === activeCollectionId);
                                        if (col) addRequestToFolder(col.id, item.id);
                                    }}
                                    className="w-full text-left px-3 py-2 text-xs text-corporate-600 dark:text-corporate-400 hover:bg-corporate-50 dark:hover:bg-corporate-900/20 flex items-center gap-2"
                                >
                                    <FilePlus size={11} /> New Request
                                </button>
                            )}
                            {(item.type === 'request' || item.type === 'websocket') && (
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }}
                                        className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                    >
                                        <FolderPlus size={11} /> Move to...
                                    </button>
                                    {showMoveMenu && (() => {
                                        const col = collections.find(c => c.id === activeCollectionId);
                                        if (!col) return null;
                                        const folders = (col.items || []).filter(i => i.type === 'folder');
                                        return (
                                            <div className="ml-4 border-l-2 border-slate-200 dark:border-slate-700 pl-1">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowMoveMenu(false); moveItemToFolder(item.id, null, col.id); }}
                                                    className="w-full text-left px-3 py-1.5 text-[10px] text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
                                                >
                                                    Collection Root
                                                </button>
                                                {folders.map(f => (
                                                    <button
                                                        key={f.id}
                                                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowMoveMenu(false); moveItemToFolder(item.id, f.id, col.id); }}
                                                        className="w-full text-left px-3 py-1.5 text-[10px] text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1.5"
                                                    >
                                                        <Folder size={10} /> {f.name}
                                                    </button>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>
                            )}
                            {item.type === 'collection' && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleMenuAction('export'); }}
                                    className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                >
                                    <Download size={11} /> Export (Postman)
                                </button>
                            )}
                            <button
                                onClick={(e) => { e.stopPropagation(); handleMenuAction('delete'); }}
                                className="w-full text-left px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 border-t border-slate-100 dark:border-slate-800"
                            >
                                <Trash2 size={11} /> Delete
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {expanded && item.items && (
                <div>
                    {item.items.map(sub => (
                        <SidebarItem key={sub.id} item={sub} level={level + 1} />
                    ))}
                </div>
            )}
            {showShareModal && (
                <ShareModal
                    isOpen={showShareModal}
                    onClose={() => setShowShareModal(false)}
                    collectionName={item.name}
                    collectionId={item.id}
                />
            )}
            {showDeleteConfirm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]" onClick={() => setShowDeleteConfirm(false)}>
                    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl p-5 max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 mb-2">Delete Collection</h3>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            Are you sure you want to delete <strong className="text-slate-700 dark:text-slate-300">{item.name}</strong>?
                        </p>
                        <p className="text-xs text-red-500 dark:text-red-400 mb-4">
                            This will permanently delete all {(item.items || []).filter(i => i.type === 'request').length} request(s), {(item.testSuites || []).length} test suite(s), and all run history. This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-2">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={() => { setShowDeleteConfirm(false); deleteRequest(item.id); }}
                                className="px-3 py-1.5 text-xs bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors"
                            >
                                Delete Collection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};


// --- Collection-Level Auto-Auth Panel ---
const CollectionAutoAuthPanel = ({ collection, updateCollection }) => {
    const [tokenStatus, setTokenStatus] = useState(null);
    const [tokenError, setTokenError] = useState(null);

    const handleChange = (field, value) => {
        updateCollection(collection.id, { [field]: value });
    };

    const handleTestLogin = async () => {
        setTokenStatus('loading');
        setTokenError(null);
        try {
            let loginBody = null;
            const bodyStr = collection.autoAuthBody || '';
            if (bodyStr.trim()) {
                try { loginBody = JSON.parse(bodyStr); } catch { loginBody = bodyStr; }
            }
            const loginHeaders = { 'Content-Type': 'application/json' };
            (collection.autoAuthLoginHeaders || []).forEach(h => {
                if (h.key && h.key.trim()) loginHeaders[h.key.trim()] = h.value || '';
            });

            const res = await authFetch(`${API_BASE}/proxy`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: collection.autoAuthLoginUrl,
                    method: collection.autoAuthMethod || 'POST',
                    headers: loginHeaders,
                    body: loginBody,
                })
            });
            const result = await res.json();

            if (!res.ok || result.status >= 400) {
                setTokenStatus('error');
                setTokenError(`Login returned ${result.status}: ${JSON.stringify(result.data).slice(0, 200)}`);
                return;
            }

            const tokenPath = (collection.autoAuthTokenPath || 'token').split('.');
            let token = result.data;
            for (const key of tokenPath) {
                if (token && typeof token === 'object') token = token[key];
                else { token = null; break; }
            }

            if (!token || typeof token !== 'string') {
                setTokenStatus('error');
                setTokenError(`Could not find token at path "${collection.autoAuthTokenPath || 'token'}" in response`);
                return;
            }

            updateCollection(collection.id, { autoAuthToken: token, autoAuthTokenTime: Date.now() });
            setTokenStatus('success');
        } catch (err) {
            setTokenStatus('error');
            setTokenError(err.message);
        }
    };

    const inputClass = "w-full text-[11px] font-mono px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-corporate-500";
    const labelClass = "text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 block";

    return (
        <div className="space-y-2">
            <div className="p-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
                <p className="text-[9px] text-blue-700 dark:text-blue-300">
                    Configure login endpoint. All requests in this collection will auto-login and attach the token.
                </p>
            </div>

            <div>
                <label className={labelClass}>Login URL</label>
                <input
                    type="text"
                    value={collection.autoAuthLoginUrl || ''}
                    onChange={(e) => handleChange('autoAuthLoginUrl', e.target.value)}
                    placeholder="https://api.example.com/login"
                    className={inputClass}
                />
            </div>

            <div className="flex gap-2">
                <div className="w-20">
                    <label className={labelClass}>Method</label>
                    <select
                        value={collection.autoAuthMethod || 'POST'}
                        onChange={(e) => handleChange('autoAuthMethod', e.target.value)}
                        className="w-full text-[11px] px-1 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-corporate-500"
                    >
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                        <option value="GET">GET</option>
                    </select>
                </div>
                <div className="flex-1">
                    <label className={labelClass}>Token Path</label>
                    <input
                        type="text"
                        value={collection.autoAuthTokenPath || ''}
                        onChange={(e) => handleChange('autoAuthTokenPath', e.target.value)}
                        placeholder="token"
                        className={inputClass}
                    />
                </div>
            </div>

            <div>
                <label className={labelClass}>Login Headers</label>
                <div className="space-y-1">
                    {(collection.autoAuthLoginHeaders || []).map((h, idx) => (
                        <div key={idx} className="flex gap-1 items-center">
                            <input
                                type="text"
                                value={h.key || ''}
                                onChange={e => {
                                    const updated = [...(collection.autoAuthLoginHeaders || [])];
                                    updated[idx] = { ...updated[idx], key: e.target.value };
                                    handleChange('autoAuthLoginHeaders', updated);
                                }}
                                placeholder="Header"
                                className={`${inputClass} flex-1`}
                            />
                            <input
                                type="text"
                                value={h.value || ''}
                                onChange={e => {
                                    const updated = [...(collection.autoAuthLoginHeaders || [])];
                                    updated[idx] = { ...updated[idx], value: e.target.value };
                                    handleChange('autoAuthLoginHeaders', updated);
                                }}
                                placeholder="Value"
                                className={`${inputClass} flex-1`}
                            />
                            <button
                                onClick={() => handleChange('autoAuthLoginHeaders', (collection.autoAuthLoginHeaders || []).filter((_, i) => i !== idx))}
                                className="text-slate-400 hover:text-red-500 text-[10px] px-0.5 shrink-0"
                            >✕</button>
                        </div>
                    ))}
                    <button
                        onClick={() => handleChange('autoAuthLoginHeaders', [...(collection.autoAuthLoginHeaders || []), { key: '', value: '' }])}
                        className="text-[9px] text-corporate-600 dark:text-corporate-400 hover:underline"
                    >+ Add Header</button>
                </div>
            </div>

            <div>
                <label className={labelClass}>Login Body (JSON)</label>
                <textarea
                    value={collection.autoAuthBody || ''}
                    onChange={(e) => handleChange('autoAuthBody', e.target.value)}
                    placeholder='{"email": "user@example.com", "password": "pass"}'
                    className={`${inputClass} resize-none`}
                    rows={3}
                />
            </div>

            <div className="flex items-center gap-1.5">
                <button
                    onClick={handleTestLogin}
                    disabled={tokenStatus === 'loading' || !collection.autoAuthLoginUrl}
                    className="px-2.5 py-1 text-[10px] font-semibold text-white bg-corporate-600 hover:bg-corporate-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 rounded transition-colors"
                >
                    {tokenStatus === 'loading' ? 'Logging in...' : 'Test Login'}
                </button>
                {collection.autoAuthToken && (
                    <button
                        onClick={() => updateCollection(collection.id, { autoAuthToken: '', autoAuthTokenTime: null })}
                        className="px-2 py-1 text-[10px] text-slate-500 hover:text-red-500 transition-colors"
                    >
                        Clear Token
                    </button>
                )}
            </div>

            {collection.autoAuthToken && (
                <div className="p-1.5 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                    <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] font-bold text-green-700 dark:text-green-400">
                            {tokenStatus === 'success' ? 'Token acquired' : 'Cached token'}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => { navigator.clipboard.writeText(collection.autoAuthToken); }}
                                className="text-[8px] px-1.5 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-700 transition-colors"
                                title="Copy token"
                            >
                                Copy
                            </button>
                            <button
                                onClick={handleTestLogin}
                                disabled={tokenStatus === 'loading' || !collection.autoAuthLoginUrl}
                                className="text-[8px] px-1.5 py-0.5 bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-300 rounded hover:bg-green-200 dark:hover:bg-green-700 transition-colors disabled:opacity-50"
                                title="Refresh token"
                            >
                                Refresh
                            </button>
                        </div>
                    </div>
                    <code className="text-[9px] text-green-800 dark:text-green-300 break-all block font-mono">
                        {collection.autoAuthToken.length > 60 ? collection.autoAuthToken.slice(0, 60) + '...' : collection.autoAuthToken}
                    </code>
                    {collection.autoAuthTokenTime && (
                        <span className="text-[8px] text-green-500 dark:text-green-500 mt-0.5 block">
                            {new Date(collection.autoAuthTokenTime).toLocaleString()}
                        </span>
                    )}
                </div>
            )}

            {tokenStatus === 'error' && (
                <div className="p-1.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
                    <span className="text-[9px] font-bold text-red-600 dark:text-red-400">Login Failed</span>
                    <p className="text-[9px] text-red-500 dark:text-red-400 mt-0.5 break-all">{tokenError}</p>
                </div>
            )}

            <p className="text-[9px] text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-800 pt-1">
                Token refreshes automatically if older than 30 min. Sent as <code className="bg-slate-100 dark:bg-slate-800 px-0.5 rounded text-[8px]">Authorization: Bearer &lt;token&gt;</code>
            </p>
        </div>
    );
};


export const Sidebar = ({ onCollapse }) => {
    const collections = useWorkspaceStore(state => state.collections);
    const addRequest = useWorkspaceStore(state => state.addRequest);
    const addWebSocket = useWorkspaceStore(state => state.addWebSocket);
    const addCollection = useWorkspaceStore(state => state.addCollection);
    const addFolderAction = useWorkspaceStore(state => state.addFolder);
    const activeCollectionId = useWorkspaceStore(state => state.activeCollectionId);
    const viewRunFromHistory = useWorkspaceStore(state => state.viewRunFromHistory);
    const updateCollection = useWorkspaceStore(state => state.updateCollection);
    // Per-collection run history
    const activeCollection = collections.find(c => c.id === activeCollectionId);
    const runHistory = activeCollection?.runHistory || [];
    const activeEnv = useWorkspaceStore(state => state.activeEnv);
    const requestHistory = useWorkspaceStore(state => state.requestHistory);
    const [searchQuery, setSearchQuery] = useState('');
    const [showSearch, setShowSearch] = useState(false);
    const [showAddMenu, setShowAddMenu] = useState(false);
    const [showInlineNewColl, setShowInlineNewColl] = useState(false);
    const [inlineNewCollName, setInlineNewCollName] = useState('');
    const [showHistory, setShowHistory] = useState(false);
    const [showRequestHistory, setShowRequestHistory] = useState(false);
    const [showEnvManager, setShowEnvManager] = useState(false);
    const [showCurlImport, setShowCurlImport] = useState(false);
    const [showCollectionImport, setShowCollectionImport] = useState(false);
    const [showCollectionAuth, setShowCollectionAuth] = useState(false);
    const [showCollectionScripts, setShowCollectionScripts] = useState(false);
    const addMenuRef = useRef(null);

    // Close add menu on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (addMenuRef.current && !addMenuRef.current.contains(e.target)) {
                setShowAddMenu(false);
            }
        };
        if (showAddMenu) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [showAddMenu]);

    // Flatten all requests for search (recursive to include requests inside folders)
    const flattenRequests = (collections) => {
        const results = [];
        const traverse = (items) => {
            for (const item of (items || [])) {
                if (item.type === 'request') {
                    results.push(item);
                } else if (item.type === 'folder' && item.items) {
                    traverse(item.items);
                }
            }
        };
        for (const col of collections) {
            traverse(col.items || []);
        }
        return results;
    };

    const filteredRequests = searchQuery.trim()
        ? flattenRequests(collections).filter(r =>
            r.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.url.toLowerCase().includes(searchQuery.toLowerCase()) ||
            r.method.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : null;

    return (
        <div className="w-64 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 h-full flex flex-col font-sans">
            {/* Header */}
            <div className="h-12 border-b border-slate-200 dark:border-slate-700 flex items-center px-3 justify-between bg-white dark:bg-slate-900">
                <div className="flex items-center gap-1.5">
                    {onCollapse && (
                        <button
                            onClick={onCollapse}
                            className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 dark:text-slate-500 transition-colors"
                            title="Collapse Explorer (Ctrl+B)"
                        >
                            <PanelLeftClose size={14} />
                        </button>
                    )}
                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm tracking-tight uppercase">Explorer</span>
                </div>
                <div className="flex gap-1">
                    <button
                        onClick={() => { setShowSearch(!showSearch); setSearchQuery(''); }}
                        className={`p-1.5 rounded transition-colors ${showSearch ? 'bg-corporate-100 dark:bg-corporate-900/30 text-corporate-600 dark:text-corporate-400' : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-400'}`}
                    >
                        <Search size={14} />
                    </button>
                    <div className="relative" ref={addMenuRef}>
                        <button
                            onClick={() => setShowAddMenu(!showAddMenu)}
                            className="hover:bg-slate-100 dark:hover:bg-slate-700 p-1.5 rounded text-slate-500 dark:text-slate-400 transition-colors"
                            title="Add New"
                        >
                            <Plus size={14} />
                        </button>
                        {showAddMenu && (
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-lg rounded-lg overflow-hidden z-50">
                                <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold px-3 pt-2 pb-1">New Request In</div>
                                {collections.map(col => (
                                    <button
                                        key={col.id}
                                        onClick={() => { addRequest(col.id); setShowAddMenu(false); }}
                                        className="w-full text-left px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                    >
                                        <FilePlus size={11} /> {col.name}
                                    </button>
                                ))}
                                <div className="border-t border-slate-100 dark:border-slate-800 mt-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold px-3 pt-2 pb-1">WebSocket In</div>
                                    {collections.map(col => (
                                        <button
                                            key={`ws-${col.id}`}
                                            onClick={() => { addWebSocket(col.id); setShowAddMenu(false); }}
                                            className="w-full text-left px-3 py-1.5 text-xs text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20 flex items-center gap-2"
                                        >
                                            <Plug size={11} /> {col.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="border-t border-slate-100 dark:border-slate-800 mt-1">
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold px-3 pt-2 pb-1">New Folder In</div>
                                    {collections.map(col => (
                                        <button
                                            key={`folder-${col.id}`}
                                            onClick={() => { addFolderAction(col.id); setShowAddMenu(false); }}
                                            className="w-full text-left px-3 py-1.5 text-xs text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/20 flex items-center gap-2"
                                        >
                                            <FolderPlus size={11} /> {col.name}
                                        </button>
                                    ))}
                                </div>
                                <div className="border-t border-slate-100 dark:border-slate-800 mt-1">
                                    <button
                                        onClick={() => { setShowCollectionImport(true); setShowAddMenu(false); }}
                                        className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                    >
                                        <Upload size={12} /> Import Collection
                                    </button>
                                    <button
                                        onClick={() => { setShowCurlImport(true); setShowAddMenu(false); }}
                                        className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                    >
                                        <Terminal size={12} /> Import cURL
                                    </button>
                                    {showInlineNewColl ? (
                                        <div className="px-3 py-2 flex items-center gap-1.5">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={inlineNewCollName}
                                                onChange={(e) => setInlineNewCollName(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        if (inlineNewCollName.trim()) addCollection(inlineNewCollName.trim());
                                                        setShowInlineNewColl(false);
                                                        setInlineNewCollName('');
                                                        setShowAddMenu(false);
                                                    }
                                                    if (e.key === 'Escape') {
                                                        setShowInlineNewColl(false);
                                                        setInlineNewCollName('');
                                                    }
                                                }}
                                                placeholder="Collection name..."
                                                className="flex-1 text-[11px] px-2 py-1 border border-corporate-400 rounded outline-none focus:ring-1 focus:ring-corporate-500 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 min-w-0"
                                            />
                                            <button
                                                onClick={() => {
                                                    if (inlineNewCollName.trim()) addCollection(inlineNewCollName.trim());
                                                    setShowInlineNewColl(false);
                                                    setInlineNewCollName('');
                                                    setShowAddMenu(false);
                                                }}
                                                className="text-[10px] px-2 py-1 bg-corporate-600 text-white rounded hover:bg-corporate-700 transition-colors shrink-0"
                                            >
                                                OK
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => {
                                                setShowInlineNewColl(true);
                                                setInlineNewCollName('');
                                            }}
                                            className="w-full text-left px-3 py-2 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2"
                                        >
                                            <FolderPlus size={12} /> New Collection
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Search Bar */}
            {showSearch && (
                <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search requests..."
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md outline-none focus:ring-1 focus:ring-corporate-500 bg-slate-50 dark:bg-slate-800 dark:text-slate-200"
                        autoFocus
                    />
                </div>
            )}

            {/* Scrollable area: Tree + Panels (everything between header and footer scrolls together) */}
            <div className="flex-1 overflow-y-auto min-h-0">
                {/* Tree or Search Results */}
                <div className="py-2">
                {filteredRequests ? (
                    filteredRequests.length > 0 ? (
                        filteredRequests.map(item => (
                            <SidebarItem key={item.id} item={item} level={1} />
                        ))
                    ) : (
                        <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                            No matching requests
                        </div>
                    )
                ) : (
                    collections.map(col => (
                        <SidebarItem key={col.id} item={col} />
                    ))
                )}
                </div>

            {/* Request History (Individual requests) */}
            {requestHistory && requestHistory.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setShowRequestHistory(!showRequestHistory)}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Clock size={12} />
                            <span className="uppercase tracking-wider text-[10px]">Recent</span>
                            <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">({requestHistory.length})</span>
                        </div>
                        {showRequestHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    {showRequestHistory && (
                        <div className="max-h-48 overflow-y-auto">
                            {requestHistory.slice(0, 20).map(entry => {
                                const METHOD_COLORS = {
                                    GET: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30',
                                    POST: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30',
                                    PUT: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30',
                                    DELETE: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30',
                                    PATCH: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30',
                                };
                                return (
                                    <div
                                        key={entry.id}
                                        className="px-4 py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-800"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[8px] font-bold px-1 py-0.5 rounded ${METHOD_COLORS[entry.method] || 'text-slate-500 bg-slate-50 dark:text-slate-400 dark:bg-slate-800'}`}>
                                                {entry.method}
                                            </span>
                                            <span className="text-[10px] text-slate-600 dark:text-slate-400 truncate flex-1">{entry.name}</span>
                                            <span className={`text-[10px] font-bold ${entry.success ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                                                {entry.status || 'ERR'}
                                            </span>
                                            <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">{entry.time}ms</span>
                                        </div>
                                        <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
                                            {new Date(entry.timestamp).toLocaleTimeString()}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Run History */}
            {runHistory && runHistory.length > 0 && (
                <div className="border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <History size={12} />
                            <span className="uppercase tracking-wider text-[10px]">Run History</span>
                            <span className="text-[10px] font-normal text-slate-400 dark:text-slate-500">({runHistory.length})</span>
                        </div>
                        {showHistory ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    {showHistory && (
                        <div className="max-h-48 overflow-y-auto">
                            {runHistory.map(run => (
                                <button
                                    key={run.id}
                                    onClick={() => viewRunFromHistory(run.id)}
                                    className="w-full text-left px-4 py-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-slate-700 dark:text-slate-300 font-medium truncate">{run.collectionName}</span>
                                        <div className="flex items-center gap-1.5 shrink-0 ml-2">
                                            <span className="flex items-center gap-0.5 text-[10px] text-green-600 dark:text-green-400">
                                                <CheckCircle size={9} /> {run.summary?.passed || 0}
                                            </span>
                                            {run.summary?.failed > 0 && (
                                                <span className="flex items-center gap-0.5 text-[10px] text-red-600 dark:text-red-400">
                                                    <XCircle size={9} /> {run.summary.failed}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5">
                                        {new Date(run.timestamp).toLocaleString()} — {run.summary?.totalTime || 0}ms
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Collection Auth Panel */}
            {activeCollection && (
                <div className="border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setShowCollectionAuth(!showCollectionAuth)}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <span className="text-[10px]">🔑</span>
                            <span className="uppercase tracking-wider text-[10px]">Collection Auth</span>
                            {activeCollection.authType && activeCollection.authType !== 'none' && (
                                <span className="text-[9px] bg-corporate-100 dark:bg-corporate-900/30 text-corporate-600 dark:text-corporate-400 px-1 rounded">
                                    {{ bearer: 'Bearer', basic: 'Basic', apikey: 'API Key', 'auto-auth': 'Auto' }[activeCollection.authType] || activeCollection.authType}
                                </span>
                            )}
                        </div>
                        {showCollectionAuth ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    {showCollectionAuth && (
                        <div className="px-3 pb-3 space-y-2">
                            <p className="text-[10px] text-slate-400 dark:text-slate-500">
                                All requests in this collection inherit this auth unless they have their own.
                            </p>
                            <select
                                value={activeCollection.authType || 'none'}
                                onChange={(e) => updateCollection(activeCollection.id, { authType: e.target.value })}
                                className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-corporate-500"
                            >
                                <option value="none">No Auth</option>
                                <option value="bearer">Bearer Token</option>
                                <option value="basic">Basic Auth</option>
                                <option value="apikey">API Key</option>
                                <option value="auto-auth">Auto-Auth (Login → Token)</option>
                            </select>

                            {activeCollection.authType === 'bearer' && (
                                <input
                                    type="text"
                                    placeholder="Bearer token..."
                                    value={activeCollection.authToken || ''}
                                    onChange={(e) => updateCollection(activeCollection.id, { authToken: e.target.value })}
                                    className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-corporate-500"
                                />
                            )}
                            {activeCollection.authType === 'basic' && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Username"
                                        value={activeCollection.authUsername || ''}
                                        onChange={(e) => updateCollection(activeCollection.id, { authUsername: e.target.value })}
                                        className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-corporate-500"
                                    />
                                    <input
                                        type="password"
                                        placeholder="Password"
                                        value={activeCollection.authPassword || ''}
                                        onChange={(e) => updateCollection(activeCollection.id, { authPassword: e.target.value })}
                                        className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-corporate-500"
                                    />
                                </>
                            )}
                            {activeCollection.authType === 'apikey' && (
                                <>
                                    <input
                                        type="text"
                                        placeholder="Header name (e.g. X-API-Key)"
                                        value={activeCollection.authKeyName || ''}
                                        onChange={(e) => updateCollection(activeCollection.id, { authKeyName: e.target.value })}
                                        className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-corporate-500"
                                    />
                                    <input
                                        type="text"
                                        placeholder="API key value"
                                        value={activeCollection.authKeyValue || ''}
                                        onChange={(e) => updateCollection(activeCollection.id, { authKeyValue: e.target.value })}
                                        className="w-full text-xs px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 dark:text-slate-200 outline-none focus:ring-1 focus:ring-corporate-500"
                                    />
                                </>
                            )}
                            {activeCollection.authType === 'auto-auth' && (
                                <CollectionAutoAuthPanel collection={activeCollection} updateCollection={updateCollection} />
                            )}
                        </div>
                    )}
                </div>
            )}
            {/* Collection Scripts Panel */}
            {activeCollection && (
                <div className="border-t border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setShowCollectionScripts(!showCollectionScripts)}
                        className="w-full flex items-center justify-between px-4 py-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                        <div className="flex items-center gap-2">
                            <Terminal size={12} />
                            <span className="uppercase tracking-wider text-[10px]">Collection Scripts</span>
                            {(activeCollection.preScript || activeCollection.postScript) && (
                                <span className="w-1.5 h-1.5 bg-corporate-500 rounded-full" />
                            )}
                        </div>
                        {showCollectionScripts ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    {showCollectionScripts && (
                        <div className="px-3 pb-3 space-y-2">
                            <p className="text-[9px] text-slate-400 dark:text-slate-500">
                                Runs before/after every request in this collection (before individual request scripts).
                            </p>
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-0.5 block">Pre-request Script</label>
                                <textarea
                                    value={activeCollection.preScript || ''}
                                    onChange={(e) => updateCollection(activeCollection.id, { preScript: e.target.value })}
                                    placeholder="// Runs before each request&#10;pm.variables.set('token', 'abc');"
                                    rows={4}
                                    className="w-full text-[10px] font-mono px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-900 text-green-400 outline-none focus:ring-1 focus:ring-corporate-500 resize-none placeholder-slate-600"
                                />
                            </div>
                            <div>
                                <label className="text-[9px] font-bold text-slate-500 dark:text-slate-400 mb-0.5 block">Post-response Script</label>
                                <textarea
                                    value={activeCollection.postScript || ''}
                                    onChange={(e) => updateCollection(activeCollection.id, { postScript: e.target.value })}
                                    placeholder="// Runs after each request&#10;pm.test('Status OK', () => pm.expect(pm.response.status).to.equal(200));"
                                    rows={4}
                                    className="w-full text-[10px] font-mono px-2 py-1.5 border border-slate-200 dark:border-slate-700 rounded bg-slate-900 text-green-400 outline-none focus:ring-1 focus:ring-corporate-500 resize-none placeholder-slate-600"
                                />
                            </div>
                        </div>
                    )}
                </div>
            )}
            </div>{/* End scrollable area */}

            {/* Footer — Environment Indicator */}
            <button
                onClick={() => setShowEnvManager(true)}
                className="h-9 border-t border-slate-200 dark:border-slate-700 flex items-center px-3 text-[10px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 shrink-0 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors w-full gap-2"
            >
                <Globe size={10} className="text-corporate-500" />
                <span className="font-medium">Env: {activeEnv}</span>
                <span className="ml-auto text-slate-400 dark:text-slate-500 text-[9px]">Click to manage</span>
            </button>

            {/* Environment Manager Modal */}
            {showEnvManager && <EnvironmentManager onClose={() => setShowEnvManager(false)} />}

            {/* cURL Import Modal */}
            {showCurlImport && <CurlImportModal onClose={() => setShowCurlImport(false)} />}

            {/* Collection Import Modal */}
            {showCollectionImport && <ImportCollectionModal onClose={() => setShowCollectionImport(false)} />}
        </div>
    );
};
