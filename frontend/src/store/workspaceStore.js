import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../utils/supabaseClient';
import yaml from 'js-yaml';

/**
 * Workspace Store (The "Brain" of the App)
 *
 * v2 Data Model: Collection = Workspace
 * Each collection owns its own chatMessages, openApiSpec, runHistory, testSuites.
 */

// Debounce timers for Supabase sync (per collection)
const _syncTimers = {};
const SYNC_DEBOUNCE_MS = 1500;

// Dirty tracking: collections with unsaved local edits (skip overwrite from realtime)
const _dirtyColIds = new Set();

// Debounce timer for realtime sync (prevents fetch flood from rapid DB changes)
let _realtimeSyncTimer = null;
const REALTIME_DEBOUNCE_MS = 2000;

// Built-in dynamic variables (generated fresh on each resolution)
const RANDOM_NAMES = ['Alice', 'Bob', 'Charlie', 'Diana', 'Eve', 'Frank', 'Grace', 'Henry', 'Ivy', 'Jack', 'Karen', 'Leo', 'Mia', 'Noah', 'Olivia'];
function resolveDynamicVar(key) {
    switch (key) {
        case '$timestamp': return String(Date.now());
        case '$isoTimestamp': return new Date().toISOString();
        case '$randomInt': return String(Math.floor(Math.random() * 1000));
        case '$guid': return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
        case '$randomEmail': return `user_${Math.random().toString(36).slice(2, 8)}@test.com`;
        case '$randomName': return RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
        case '$randomPhone': return String(Math.floor(1000000000 + Math.random() * 9000000000));
        case '$randomBoolean': return String(Math.random() < 0.5);
        default: return undefined;
    }
}
// Recursively flatten all items from a nested collection structure
// type param filters by item type (e.g., 'request', 'folder'); omit for all items
export const flattenItems = (items, type) => {
    const result = [];
    for (const item of (items || [])) {
        if (!type || item.type === type) result.push(item);
        if (item.items) result.push(...flattenItems(item.items, type));
    }
    return result;
};

// Flatten items with folder path info — returns [{ item, folderPath: ['Auth'], folderId }]
export const flattenItemsWithPath = (items, type, parentPath = [], parentFolderId = null) => {
    const result = [];
    for (const item of (items || [])) {
        if (!type || item.type === type) {
            result.push({ item, folderPath: [...parentPath], folderId: parentFolderId });
        }
        if (item.items) {
            result.push(...flattenItemsWithPath(
                item.items, type,
                [...parentPath, item.name],
                item.id
            ));
        }
    }
    return result;
};

// Find a folder by ID recursively in a nested items tree
export const findFolderById = (items, folderId) => {
    for (const item of (items || [])) {
        if (item.id === folderId && item.type === 'folder') return item;
        if (item.items) {
            const found = findFolderById(item.items, folderId);
            if (found) return found;
        }
    }
    return null;
};

// Build endpoint signature: "POST::/v1/users" (strips base URL, normalizes path)
export const buildEndpointSignature = (method, endpoint, baseUrl = '') => {
    let path = endpoint || '';
    if (baseUrl && path.startsWith(baseUrl)) path = path.slice(baseUrl.length);
    try { path = new URL(path.startsWith('http') ? path : `https://x${path}`).pathname; } catch { /* keep as-is */ }
    return `${(method || 'GET').toUpperCase()}::${path}`;
};

// Match a test case to the best matching request
// Strategy: 1) requestId, 2) endpointSignature, 3) fuzzy URL tail
export const matchTestToRequest = (test, requests, baseUrl = '') => {
    if (test.requestId) {
        const found = requests.find(r => r.id === test.requestId);
        if (found) return found;
    }
    const testSig = test.endpointSignature || buildEndpointSignature(test.method, test.endpoint, baseUrl);
    for (const req of requests) {
        const reqSig = buildEndpointSignature(req.method, req.url, baseUrl);
        if (reqSig === testSig) return req;
    }
    // Fuzzy: match by last 2 path segments + method
    const testPath = testSig.split('::')[1] || '';
    const testTail = testPath.split('/').filter(Boolean).slice(-2).join('/');
    if (testTail) {
        for (const req of requests) {
            const reqPath = buildEndpointSignature(req.method, req.url, baseUrl).split('::')[1] || '';
            const reqTail = reqPath.split('/').filter(Boolean).slice(-2).join('/');
            if (reqTail === testTail && (req.method || 'GET').toUpperCase() === (test.method || 'GET').toUpperCase()) {
                return req;
            }
        }
    }
    return null;
};

// Group test cases by the folder their linked request belongs to
export const groupTestsByFolder = (tests, items, baseUrl = '') => {
    const requestsWithPath = flattenItemsWithPath(items, 'request');
    const allReqs = requestsWithPath.map(r => r.item);
    const groups = new Map();

    for (const test of tests) {
        const matched = matchTestToRequest(test, allReqs, baseUrl);
        if (!matched) {
            const key = '(unlinked)';
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push({ ...test, _matchedRequest: null });
            continue;
        }
        const entry = requestsWithPath.find(r => r.item.id === matched.id);
        const folderName = entry?.folderPath?.length > 0 ? entry.folderPath.join(' / ') : '(root)';
        if (!groups.has(folderName)) groups.set(folderName, []);
        groups.get(folderName).push({ ...test, _matchedRequest: matched });
    }
    return groups;
};

// Group items into folders by first URL path segment (for spec import / test import)
const groupItemsIntoFolders = (items) => {
    const groups = {};
    for (const item of items) {
        let seg = '_root';
        try {
            const url = item.url || '';
            const path = url.startsWith('http') ? new URL(url).pathname : url;
            const parts = path.split('/').filter(Boolean);
            // Skip version segments like v1, v2, api
            const meaningful = parts.find(p => !/^(v\d+|api|docs)$/i.test(p));
            if (meaningful) seg = meaningful;
        } catch { /* keep _root */ }
        if (!groups[seg]) groups[seg] = [];
        groups[seg].push(item);
    }
    const structured = [];
    for (const [seg, groupItems] of Object.entries(groups)) {
        if (seg === '_root' || groupItems.length < 2) {
            structured.push(...groupItems);
        } else {
            structured.push({
                id: uuidv4 ? uuidv4() : `folder-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: seg.charAt(0).toUpperCase() + seg.slice(1),
                type: 'folder',
                items: groupItems
            });
        }
    }
    return structured;
};

// Find the immediate parent array containing a target item ID

export const useWorkspaceStore = create(persist((set, get) => ({
    // --- Data ---
    collections: [
        {
            id: 'default-col',
            name: 'Demo Collection',
            type: 'collection',
            items: [
                {
                    id: 'req-1',
                    name: 'Get User (Example)',
                    type: 'request',
                    method: 'GET',
                    url: 'https://jsonplaceholder.typicode.com/users/1',
                    headers: [],
                    params: [],
                    body: { type: 'json', content: '' },
                    preScript: '',
                    postScript: '',
                    assertions: []
                }
            ],
            chatMessages: [],
            openApiSpec: '',
            baseUrl: '',
            runHistory: [],
            testSuites: [],
        }
    ],

    activeTabs: [], // [{ id: 'req-1', type: 'request', collectionId: '...', ... }]
    activeTabId: null,
    activeCollectionId: 'default-col',
    currentView: 'dashboard', // 'dashboard' | 'workspace' | 'mock-server' | 'docs'
    darkMode: false,
    localMode: false, // When true, requests are sent directly from browser (bypasses /proxy — enables localhost testing)
    sidebarCollapsed: false,
    intelligenceCollapsed: false,
    sidebarWidth: 256,
    intelligenceWidth: 320,
    editorSplitRatio: 0.5,

    // Tour State
    activeTour: null,
    tourStep: 0,
    hasSeenWelcomeTour: false,

    // Interactive Tutorial State
    activeTutorial: null,

    environments: [
        { name: 'Global', vars: [] }
    ],
    activeEnv: 'Global',

    // Chain variables — extracted from responses at runtime (persisted so they survive refresh)
    chainVars: {},

    // Response cache per request (not persisted — transient runtime data)
    responses: {},

    // Collection Runner state (not persisted)
    runner: null,

    // AI test suggestions pending review (not persisted — transient)
    pendingSuggestions: {},   // { [requestId]: { suggestions: [], generatedAt, status } }

    // Contract test results cache (not persisted — transient)
    contractResults: {},     // { [collectionId]: { results: [], runAt, status } }

    // Currently selected folder in sidebar (not persisted — transient)
    activeFolderId: null,

    // Individual request history — global audit trail (persisted, capped at 50)
    requestHistory: [],

    // Subscription state (persisted)
    subscription: { plan: 'free', status: 'active', expiresAt: null },

    // Onboarding banner — shown until user explicitly dismisses it (persisted)
    dismissedOnboarding: false,
    dismissOnboarding: () => set({ dismissedOnboarding: true }),

    // --- Supabase Auth & Sync ---
    user: null,
    profile: null,

    initializeAuth: async () => {
        if (!supabase) return;

        // Check active session
        const { data: { session } } = await supabase.auth.getSession();
        set({ user: session?.user || null });
        if (session?.user) {
            // Navigate away from login page if user is already authenticated
            if (get().currentView === 'login') {
                set({ currentView: 'dashboard' });
            }
            await get().fetchProfile();
            get().fetchRemoteCollections();
            get().fetchRemoteEnvironments();
            get().subscribeToCollectionChanges();
        }

        // Listen for changes
        supabase.auth.onAuthStateChange(async (_event, session) => {
            const currentUser = get().user;
            const newUser = session?.user || null;

            if (currentUser?.id !== newUser?.id) {
                set({ user: newUser });

                if (newUser) {
                    // Navigate away from login page after sign-in (OAuth redirect)
                    if (get().currentView === 'login') {
                        set({ currentView: 'dashboard' });
                    }
                    await get().fetchProfile();
                    get().fetchRemoteCollections();
                    get().fetchRemoteEnvironments();
                    get().subscribeToCollectionChanges();
                } else {
                    // Logged Out: Reset to default empty state
                    set({
                        collections: [{
                            id: 'default-col',
                            name: 'Demo Collection',
                            type: 'collection',
                            items: [],
                            chatMessages: [],
                            openApiSpec: '',
                            baseUrl: '',
                            runHistory: [],
                            testSuites: [],
                        }],
                        activeCollectionId: 'default-col',
                        activeTabs: [],
                        activeTabId: null,
                        requestHistory: [],
                        responses: {},
                        runner: null,
                        chainVars: {},
                        environments: [{ name: 'Global', vars: [] }],
                        activeEnv: 'Global',
                        activeTour: null,
                        tourStep: 0,
                        activeTutorial: null,
                        profile: null,
                    });
                }
            }
        });
    },

    fetchProfile: async () => {
        const user = get().user;
        if (!user || !supabase) return;

        // Retry up to 3 times — profile row may not exist yet for new OAuth users
        // (the handle_new_user trigger runs asynchronously)
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();
                if (data) {
                    set({ profile: data });
                    return;
                }
                if (error && attempt < 2) {
                    // Wait before retrying (500ms, 1500ms)
                    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                }
            } catch {
                if (attempt < 2) {
                    await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
                }
            }
        }
        // After retries, set profile from user metadata as fallback
        set({
            profile: {
                id: user.id,
                email: user.email,
                full_name: user.user_metadata?.full_name || null,
                avatar_url: user.user_metadata?.avatar_url || null,
            }
        });
    },

    updateProfile: async (updates) => {
        const user = get().user;
        if (!user || !supabase) return { error: { message: 'Not authenticated' } };

        // Use upsert to handle cases where profile row doesn't exist yet
        const { error } = await supabase
            .from('profiles')
            .upsert({
                id: user.id,
                email: user.email,
                ...updates,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });

        if (!error) {
            set({ profile: { ...get().profile, ...updates } });
        }
        return { error };
    },

    logout: async () => {
        if (!supabase) return;
        try {
            await supabase.auth.signOut();
        } catch {
            // Force clear local state even if signOut fails
        }
        // onAuthStateChange listener handles state cleanup
    },

    fetchRemoteCollections: async () => {
        const { user } = get();
        if (!user || !supabase) return;

        const { data, error } = await supabase
            .from('collections')
            .select('*')
            .order('updated_at', { ascending: false });

        if (!error && data) {
            // Fetch this user's share records to determine roles
            const { data: shares } = await supabase
                .from('collection_shares')
                .select('collection_id, role')
                .eq('user_email', user.email);

            const shareRoleMap = {};
            (shares || []).forEach(s => { shareRoleMap[s.collection_id] = s.role; });

            // Merge DB columns with JSON blob + annotate share role
            const loaded = data.map(row => ({
                ...row.data,
                id: row.id,
                name: row.name,
                owner_id: row.owner_id,
                _shareRole: row.owner_id === user.id ? undefined : (shareRoleMap[row.id] || 'viewer'),
            }));

            if (loaded.length > 0) {
                // Smart merge: preserve local state for collections with unsaved edits
                const { collections: localCols, activeCollectionId } = get();
                const merged = loaded.map(remote => {
                    if (_dirtyColIds.has(remote.id)) {
                        // Keep local version — it has unsaved edits pending sync
                        const local = localCols.find(c => c.id === remote.id);
                        return local || remote;
                    }
                    return remote;
                });
                // Also keep any local-only collections not yet synced
                const remoteIds = new Set(loaded.map(c => c.id));
                const localOnly = localCols.filter(c => !remoteIds.has(c.id) && _dirtyColIds.has(c.id));
                const finalCollections = [...merged, ...localOnly];

                set({
                    collections: finalCollections,
                    activeCollectionId: finalCollections.find(c => c.id === activeCollectionId) ? activeCollectionId : finalCollections[0].id,
                });
            } else {
                // User has no cloud data yet. Give them a fresh start.
                set({
                    collections: [{
                        id: uuidv4(),
                        name: 'My Collection',
                        type: 'collection',
                        items: [],
                        chatMessages: [],
                        openApiSpec: '',
                        baseUrl: '',
                        runHistory: [],
                        testSuites: [],
                    }],
                    activeCollectionId: null
                });
                set(state => ({ activeCollectionId: state.collections[0].id }));
            }
        }
    },

    saveCollectionToSupabase: async (colId) => {
        const { user, collections } = get();
        if (!user || !supabase) return;

        const col = collections.find(c => c.id === colId);
        if (!col) return;

        _dirtyColIds.add(colId);
        const { id, name, owner_id, _shareRole, ...rest } = col;

        await supabase.from('collections').upsert({
            id,
            name,
            owner_id: owner_id || user.id,
            data: rest,
            updated_at: new Date().toISOString()
        });
        _dirtyColIds.delete(colId);
    },

    // Debounced version — waits for inactivity before syncing (for keystroke-heavy operations)
    debouncedSaveToSupabase: (colId) => {
        _dirtyColIds.add(colId);
        if (_syncTimers[colId]) clearTimeout(_syncTimers[colId]);
        _syncTimers[colId] = setTimeout(() => {
            delete _syncTimers[colId];
            get().saveCollectionToSupabase(colId).then(() => {
                _dirtyColIds.delete(colId);
            });
        }, SYNC_DEBOUNCE_MS);
    },

    // --- Environment Sync ---

    fetchRemoteEnvironments: async () => {
        const { user } = get();
        if (!user || !supabase) return;

        const { data, error } = await supabase
            .from('environments')
            .select('*')
            .order('created_at', { ascending: true });

        if (!error && data && data.length > 0) {
            const loaded = data.map(row => ({
                name: row.name,
                vars: row.vars || []
            }));
            // Ensure Global always exists
            if (!loaded.find(e => e.name === 'Global')) {
                loaded.unshift({ name: 'Global', vars: [] });
            }
            set({ environments: loaded });
        }
    },

    saveEnvironmentToSupabase: async (envName) => {
        const { user, environments } = get();
        if (!user || !supabase) return;

        const env = environments.find(e => e.name === envName);
        if (!env) return;

        await supabase.from('environments').upsert({
            owner_id: user.id,
            name: env.name,
            vars: env.vars,
            updated_at: new Date().toISOString()
        }, { onConflict: 'owner_id,name' });
    },

    deleteEnvironmentFromSupabase: async (envName) => {
        const { user } = get();
        if (!user || !supabase) return;

        await supabase.from('environments')
            .delete()
            .eq('owner_id', user.id)
            .eq('name', envName);
    },

    // --- Real-Time Subscription ---

    _realtimeChannel: null,

    subscribeToCollectionChanges: () => {
        if (!supabase) return;

        // Unsubscribe from previous channel if exists
        const prev = get()._realtimeChannel;
        if (prev) {
            supabase.removeChannel(prev);
        }

        const debouncedFetch = () => {
            if (_realtimeSyncTimer) clearTimeout(_realtimeSyncTimer);
            _realtimeSyncTimer = setTimeout(() => {
                _realtimeSyncTimer = null;
                get().fetchRemoteCollections();
            }, REALTIME_DEBOUNCE_MS);
        };

        const channel = supabase
            .channel('collections-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, debouncedFetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'collection_shares' }, debouncedFetch)
            .subscribe();

        set({ _realtimeChannel: channel });
    },

    // --- Helpers ---

    getActiveCollection: () => {
        const state = get();
        return state.collections.find(c => c.id === state.activeCollectionId) || null;
    },

    // Determine the current user's role for a collection: 'owner' | 'editor' | 'viewer' | null
    getCollectionRole: (colId) => {
        const { user, collections } = get();
        if (!user) return null;
        const col = collections.find(c => c.id === colId);
        if (!col) return null;
        if (!col.owner_id || col.owner_id === user.id) return 'owner';
        return col._shareRole || 'viewer';
    },

    // Convenience: check if user can edit a collection (owner or editor)
    canEditCollection: (colId) => {
        const role = get().getCollectionRole(colId);
        return role === 'owner' || role === 'editor';
    },

    // --- Per-Collection Chat Actions ---

    addCollectionChatMessage: (msg) => set((state) => {
        const colId = state.activeCollectionId;
        return {
            collections: state.collections.map(col => {
                if (col.id !== colId) return col;
                const msgs = [...(col.chatMessages || []), msg];
                return { ...col, chatMessages: msgs.length > 100 ? msgs.slice(-100) : msgs };
            })
        };
    }),

    updateCollectionChatMessage: (idx, updates) => set((state) => {
        const colId = state.activeCollectionId;
        return {
            collections: state.collections.map(col =>
                col.id === colId
                    ? {
                        ...col,
                        chatMessages: (col.chatMessages || []).map((m, i) =>
                            i === idx ? { ...m, ...updates } : m
                        )
                    }
                    : col
            )
        };
    }),

    clearCollectionChat: () => set((state) => {
        const colId = state.activeCollectionId;
        return {
            collections: state.collections.map(col =>
                col.id === colId ? { ...col, chatMessages: [] } : col
            )
        };
    }),

    // --- Per-Collection OpenAPI Spec ---

    setCollectionOpenApiSpec: (spec) => set((state) => {
        const colId = state.activeCollectionId;
        return {
            collections: state.collections.map(col =>
                col.id === colId ? { ...col, openApiSpec: spec } : col
            )
        };
    }),

    setCollectionBaseUrl: (url) => set((state) => {
        const colId = state.activeCollectionId;
        return {
            collections: state.collections.map(col =>
                col.id === colId ? { ...col, baseUrl: url } : col
            )
        };
    }),

    // --- Per-Collection Run History ---

    saveRunToCollection: (run) => set((state) => {
        const colId = state.runner?.collectionId || state.activeCollectionId;
        const folderId = state.runner?.folderId || null;
        return {
            collections: state.collections.map(col =>
                col.id === colId
                    ? {
                        ...col,
                        runHistory: [
                            { id: uuidv4(), timestamp: Date.now(), folderId, ...run },
                            ...(col.runHistory || [])
                        ].slice(0, 20)
                    }
                    : col
            )
        };
    }),

    viewRunFromHistory: (runId, colId) => set((state) => {
        const col = state.collections.find(c => c.id === (colId || state.activeCollectionId));
        if (!col) return {};
        const run = (col.runHistory || []).find(r => r.id === runId);
        if (!run) return {};
        return {
            runner: {
                collectionId: col.id,
                collectionName: run.collectionName || col.name,
                requests: [],
                running: false,
                progress: run.results.length,
                results: run.results,
                summary: run.summary,
                isHistorical: true,
                timestamp: run.timestamp
            }
        };
    }),

    // --- Per-Collection Test Suites ---

    addTestSuite: (colId, suite, folderId = null) => {
        const state = get();
        const col = state.collections.find(c => c.id === colId);
        const allRequests = col ? flattenItems(col.items, 'request') : [];

        // Enrich each test with ID, endpointSignature, and auto-linked requestId
        const enrichedTests = (suite.tests || []).map(test => {
            const testId = test.id || uuidv4();
            const sig = buildEndpointSignature(test.method, test.endpoint, col?.baseUrl);
            const matched = matchTestToRequest({ ...test, endpointSignature: sig }, allRequests, col?.baseUrl);
            return {
                ...test,
                id: testId,
                requestId: matched?.id || null,
                endpointSignature: sig,
                lastResult: test.lastResult || null,
            };
        });

        set((state) => ({
            collections: state.collections.map(c =>
                c.id === colId
                    ? {
                        ...c,
                        testSuites: [
                            { id: uuidv4(), createdAt: Date.now(), source: 'ai', folderId: folderId || null, ...suite, tests: enrichedTests },
                            ...(c.testSuites || [])
                        ]
                    }
                    : c
            )
        }));
        get().saveCollectionToSupabase(colId);
    },

    deleteTestSuite: (colId, suiteId) => set((state) => ({
        collections: state.collections.map(col =>
            col.id === colId
                ? { ...col, testSuites: (col.testSuites || []).filter(s => s.id !== suiteId) }
                : col
        )
    })),

    // Import test suite endpoints as collection requests (folder-aware)
    importTestsToCollection: (colId, tests) => {
        const state = get();
        const col = state.collections.find(c => c.id === colId);
        if (!col) return { imported: 0, skipped: 0 };

        const existingKeys = new Set(
            flattenItems(col.items, 'request').map(i => `${i.method}::${i.url}`)
        );

        let imported = 0, skipped = 0;
        const newItems = [];

        for (const test of tests) {
            const key = `${(test.method || 'GET').toUpperCase()}::${test.endpoint || test.url || ''}`;
            if (existingKeys.has(key)) { skipped++; continue; }

            newItems.push({
                id: `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: test.name || `${test.method} ${test.endpoint || ''}`,
                type: 'request',
                method: (test.method || 'GET').toUpperCase(),
                url: test.endpoint || test.url || '',
                headers: Object.entries(test.headers || {}).map(([k, v]) => ({ key: k, value: v, enabled: true })),
                params: [],
                body: { type: 'json', content: test.payload ? JSON.stringify(test.payload, null, 2) : '' },
                assertions: test.expected_status ? [{ id: uuidv4(), type: 'status_code', comparison: 'equals', expected: String(test.expected_status), enabled: true }] : [],
            });
            existingKeys.add(key);
            imported++;
        }

        if (newItems.length > 0) {
            // Auto-organize into folders by URL path segment
            const structured = groupItemsIntoFolders(newItems);
            set((s) => ({
                collections: s.collections.map(c =>
                    c.id === colId ? { ...c, items: [...(c.items || []), ...structured] } : c
                )
            }));
            get().debouncedSaveToSupabase(colId);
        }
        return { imported, skipped };
    },

    // Save test suite run summary for inline display
    updateTestSuiteSummary: (colId, suiteId, summary) => set((state) => ({
        collections: state.collections.map(col =>
            col.id === colId
                ? {
                    ...col,
                    testSuites: (col.testSuites || []).map(s =>
                        s.id === suiteId ? { ...s, lastRunSummary: summary } : s
                    )
                }
                : col
        )
    })),

    // --- Test Dashboard & AI Suggestions ---

    // Open test dashboard as a tab in the editor area (follows openCollectionSettings pattern)
    openTestDashboard: (colId, folderId = null) => set((state) => {
        const col = state.collections.find(c => c.id === colId);
        if (!col) return {};
        let tabName = `${col.name} Tests`;
        if (folderId) {
            const folder = findFolderById(col.items, folderId);
            if (!folder) return {};
            tabName = `${folder.name} Tests`;
        }
        const tabId = folderId
            ? `test-dashboard-${colId}-folder-${folderId}`
            : `test-dashboard-${colId}`;
        const dashTab = {
            id: tabId, type: 'test-dashboard', name: tabName,
            collectionId: colId, folderId: folderId || null,
        };
        const existing = state.activeTabs.find(t => t.id === tabId);
        if (existing) {
            return { activeTabId: tabId, activeCollectionId: colId, currentView: 'workspace' };
        }
        return {
            activeTabs: [...state.activeTabs, dashTab],
            activeTabId: tabId, activeCollectionId: colId, currentView: 'workspace'
        };
    }),

    // Store AI suggestions pending review (transient, per request)
    setPendingSuggestions: (requestId, suggestions) => set((state) => ({
        pendingSuggestions: {
            ...state.pendingSuggestions,
            [requestId]: { suggestions, generatedAt: Date.now(), status: 'ready' }
        }
    })),

    clearPendingSuggestions: (requestId) => set((state) => {
        const { [requestId]: _, ...rest } = state.pendingSuggestions;
        return { pendingSuggestions: rest };
    }),

    // Approve a single suggestion: converts it to real assertions on the request
    approveSuggestion: (requestId, suggestion) => {
        const state = get();
        // Find request across all collections
        let targetColId = null;
        for (const col of state.collections) {
            if (flattenItems(col.items).some(i => i.id === requestId)) {
                targetColId = col.id;
                break;
            }
        }
        if (!targetColId) return;

        // Build assertions from suggestion
        const newAssertions = (suggestion.assertions || []).map(a => ({
            id: uuidv4(),
            type: a.type || 'status_code',
            target: a.target || '',
            comparison: a.comparison || 'equals',
            expected: a.expected || '',
            enabled: a.enabled !== false,
        }));

        // Add to request's existing assertions
        const updateRecursive = (items) => items.map(item => {
            if (item.id === requestId) {
                return { ...item, assertions: [...(item.assertions || []), ...newAssertions] };
            }
            if (item.items) return { ...item, items: updateRecursive(item.items) };
            return item;
        });

        set((s) => ({
            collections: s.collections.map(col =>
                col.id === targetColId ? { ...col, items: updateRecursive(col.items) } : col
            ),
            // Also update the tab if it's open
            activeTabs: s.activeTabs.map(t => {
                if (t.id === requestId) {
                    return { ...t, assertions: [...(t.assertions || []), ...newAssertions] };
                }
                return t;
            })
        }));
        get().debouncedSaveToSupabase(targetColId);
    },

    // Approve all pending suggestions for a request
    approveAllSuggestions: (requestId) => {
        const state = get();
        const pending = state.pendingSuggestions[requestId];
        if (!pending?.suggestions?.length) return;
        for (const sug of pending.suggestions) {
            get().approveSuggestion(requestId, sug);
        }
        get().clearPendingSuggestions(requestId);
    },

    // Store contract test results (transient, per collection)
    setContractResults: (colId, results) => set((state) => ({
        contractResults: {
            ...state.contractResults,
            [colId]: { results, runAt: Date.now(), status: 'complete' }
        }
    })),

    // Auto-link all tests in a suite to matching requests
    autoLinkTestSuite: (colId, suiteId) => {
        const state = get();
        const col = state.collections.find(c => c.id === colId);
        if (!col) return { linked: 0, unlinked: 0 };
        const allRequests = flattenItems(col.items, 'request');
        let linked = 0, unlinked = 0;

        set((s) => ({
            collections: s.collections.map(c => {
                if (c.id !== colId) return c;
                return {
                    ...c,
                    testSuites: (c.testSuites || []).map(suite => {
                        if (suite.id !== suiteId) return suite;
                        return {
                            ...suite,
                            tests: suite.tests.map(test => {
                                const matched = matchTestToRequest(test, allRequests, col.baseUrl);
                                if (matched) { linked++; return { ...test, requestId: matched.id }; }
                                else { unlinked++; return test; }
                            })
                        };
                    })
                };
            })
        }));
        get().debouncedSaveToSupabase(colId);
        return { linked, unlinked };
    },

    // Track active folder in sidebar
    setActiveFolderId: (folderId) => set({ activeFolderId: folderId }),

    // Open collection settings as a tab in the editor area
    openCollectionSettings: (colId) => set((state) => {
        const col = state.collections.find(c => c.id === colId);
        if (!col) return {};
        const tabId = `settings-${colId}`;
        const settingsTab = {
            id: tabId, type: 'collection-settings', name: col.name,
            collectionId: colId
        };
        const existing = state.activeTabs.find(t => t.id === tabId);
        if (existing) {
            return { activeTabId: tabId, activeCollectionId: colId, currentView: 'workspace' };
        }
        return {
            activeTabs: [...state.activeTabs, settingsTab],
            activeTabId: tabId, activeCollectionId: colId, currentView: 'workspace'
        };
    }),

    // --- Actions ---

    // Tabs
    openTab: (item) => set((state) => {
        // Find which collection this request belongs to
        let colId = item.collectionId || null;
        if (!colId) {
            for (const col of state.collections) {
                if (flattenItems(col.items).some(i => i.id === item.id)) {
                    colId = col.id;
                    break;
                }
            }
        }
        const taggedItem = { ...item, collectionId: colId };

        const existing = state.activeTabs.find(t => t.id === item.id);
        if (existing) {
            return { activeTabId: item.id, activeCollectionId: colId || state.activeCollectionId };
        }
        return {
            activeTabs: [...state.activeTabs, taggedItem],
            activeTabId: item.id,
            activeCollectionId: colId || state.activeCollectionId
        };
    }),

    closeTab: (id) => set((state) => {
        const newTabs = state.activeTabs.filter(t => t.id !== id);
        let newActiveId = state.activeTabId;

        if (state.activeTabId === id) {
            // Prefer a tab from the same collection
            const sameColTabs = newTabs.filter(t => t.collectionId === state.activeCollectionId);
            newActiveId = sameColTabs.length > 0
                ? sameColTabs[sameColTabs.length - 1].id
                : (newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null);
        }

        // Clean up response cache for closed tab
        const { [id]: _, ...restResponses } = state.responses;

        return {
            activeTabs: newTabs,
            activeTabId: newActiveId,
            responses: restResponses
        };
    }),

    setActiveTab: (id) => set({ activeTabId: id }),
    setActiveCollection: (id) => set({ activeCollectionId: id }),
    setCurrentView: (view) => set({ currentView: view }),
    toggleDarkMode: () => set((state) => {
        const next = !state.darkMode;
        if (next) document.documentElement.classList.add('dark');
        else document.documentElement.classList.remove('dark');
        return { darkMode: next };
    }),

    toggleLocalMode: () => set((state) => ({ localMode: !state.localMode })),
    toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
    toggleIntelligence: () => set((state) => ({ intelligenceCollapsed: !state.intelligenceCollapsed })),
    setSidebarWidth: (w) => set({ sidebarWidth: Math.max(200, Math.min(400, w)) }),
    setIntelligenceWidth: (w) => set({ intelligenceWidth: Math.max(240, Math.min(480, w)) }),
    setEditorSplitRatio: (r) => set({ editorSplitRatio: Math.max(0.25, Math.min(0.75, r)) }),

    // Subscription
    setSubscription: (sub) => set({ subscription: { ...sub } }),

    // Tour Actions
    startTour: (tourName) => set(() => {
        const updates = { activeTour: tourName, tourStep: 0 };
        // Context switching
        if (tourName === 'mock-server') updates.currentView = 'mock-server';
        if (tourName === 'welcome') updates.currentView = 'dashboard';
        return updates;
    }),
    stopTour: () => set({ activeTour: null, tourStep: 0, hasSeenWelcomeTour: true }),
    setTourStep: (step) => set({ tourStep: step }),

    // Interactive Tutorial Actions
    startTutorial: (tutorialName) => set({ activeTutorial: tutorialName }),
    stopTutorial: () => set({ activeTutorial: null }),

    // Find which collection a request belongs to (recursive — checks inside folders)
    findCollectionForRequest: (reqId) => {
        const state = get();
        for (const col of state.collections) {
            if (flattenItems(col.items).some(item => item.id === reqId)) return col.id;
        }
        return null;
    },

    // Collections
    addCollection: (name) => {
        const newId = uuidv4();
        set((state) => ({
            collections: [...state.collections, {
                id: newId,
                name,
                type: 'collection',
                items: [],
                chatMessages: [],
                openApiSpec: '',
                baseUrl: '',
                runHistory: [],
                testSuites: [],
                // Collection-level auth (inherited by all requests unless overridden)
                authType: 'none',
                authToken: '',
                authUsername: '',
                authPassword: '',
                authKeyName: '',
                authKeyValue: '',
                // Auto-auth fields (collection-level)
                autoAuthLoginUrl: '',
                autoAuthMethod: 'POST',
                autoAuthBody: '',
                autoAuthTokenPath: 'token',
                autoAuthLoginHeaders: [],
                autoAuthToken: '',
                autoAuthTokenTime: null,
                // Force collection auth on all requests
                forceCollectionAuth: false,
                // Collection-level scripts
                preScript: '',
                postScript: '',
            }],
            activeCollectionId: newId
        }));
        get().saveCollectionToSupabase(newId);
    },

    // Load a pre-built demo collection (JSONPlaceholder) for new users
    loadDemoCollection: () => {
        const colId = uuidv4();
        const BASE = 'https://jsonplaceholder.typicode.com';
        const mkReq = (name, method, path, body) => ({
            id: uuidv4(), name, type: 'request', method, url: `${BASE}${path}`,
            headers: body ? [{ key: 'Content-Type', value: 'application/json', enabled: true }] : [],
            params: [], body: { type: 'json', content: body || '' },
            preScript: '', postScript: '', assertions: [], collectionId: colId,
        });
        const items = [
            mkReq('List Posts', 'GET', '/posts', null),
            mkReq('Get Post', 'GET', '/posts/1', null),
            mkReq('Create Post', 'POST', '/posts', JSON.stringify({ title: 'Hello TestOrbit', body: 'AI-powered API testing!', userId: 1 }, null, 2)),
            mkReq('Update Post', 'PUT', '/posts/1', JSON.stringify({ id: 1, title: 'Updated Title', body: 'Updated body', userId: 1 }, null, 2)),
            mkReq('Delete Post', 'DELETE', '/posts/1', null),
        ];
        set((state) => ({
            collections: [...state.collections, {
                id: colId, name: 'JSONPlaceholder Demo', type: 'collection',
                items, chatMessages: [], openApiSpec: '', baseUrl: BASE,
                runHistory: [], testSuites: [],
                authType: 'none', authToken: '', authUsername: '', authPassword: '',
                authKeyName: '', authKeyValue: '',
                autoAuthLoginUrl: '', autoAuthMethod: 'POST', autoAuthBody: '',
                autoAuthTokenPath: 'token', autoAuthLoginHeaders: [],
                autoAuthToken: '', autoAuthTokenTime: null,
                forceCollectionAuth: false, preScript: '', postScript: '',
            }],
            activeCollectionId: colId,
            activeTabs: [items[0]],
            activeTabId: items[0].id,
        }));
    },

    // Update collection-level properties (auth, baseUrl, etc.)
    updateCollection: (colId, updates) => {
        set((state) => ({
            collections: state.collections.map(col =>
                col.id === colId ? { ...col, ...updates } : col
            )
        }));
        get().debouncedSaveToSupabase(colId);
    },

    // Add New WebSocket to a specific collection
    addWebSocket: (collectionId = 'default-col') => {
        const newId = uuidv4();
        const newWs = {
            id: newId,
            name: 'New WebSocket',
            type: 'websocket',
            method: 'WS',
            url: 'wss://',
            collectionId
        };

        set((state) => {
            const newCollections = state.collections.map(col => {
                if (col.id === collectionId) {
                    return { ...col, items: [...col.items, newWs] };
                }
                return col;
            });

            return {
                collections: newCollections,
                activeTabs: [...state.activeTabs, newWs],
                activeTabId: newId,
                activeCollectionId: collectionId
            };
        });
        get().saveCollectionToSupabase(collectionId);
    },

    // Request Updates (Real-time syncing — single atomic set)
    updateRequest: (id, updates) => {
        let updatedItem = null;
        const updateRecursive = (items) => {
            return items.map(item => {
                if (item.id === id) {
                    updatedItem = { ...item, ...updates };
                    return updatedItem;
                }
                if (item.items) {
                    return { ...item, items: updateRecursive(item.items) };
                }
                return item;
            });
        };

        set((state) => {
            const newCollections = updateRecursive(state.collections);
            return {
                collections: newCollections,
                activeTabs: updatedItem
                    ? state.activeTabs.map(t => t.id === id ? updatedItem : t)
                    : state.activeTabs
            };
        });

        const colId = get().findCollectionForRequest(id);
        if (colId) get().debouncedSaveToSupabase(colId);
    },

    // Add New Request to a specific collection
    addRequest: (collectionId = 'default-col') => {
        const newId = uuidv4();
        const newReq = {
            id: newId,
            name: 'New Request',
            type: 'request',
            method: 'GET',
            url: '',
            headers: [],
            params: [],
            body: { type: 'json', content: '' },
            preScript: '',
            postScript: '',
            assertions: [],
            collectionId
        };

        set((state) => {
            const newCollections = state.collections.map(col => {
                if (col.id === collectionId) {
                    return { ...col, items: [...col.items, newReq] };
                }
                return col;
            });

            return {
                collections: newCollections,
                activeTabs: [...state.activeTabs, newReq],
                activeTabId: newId,
                activeCollectionId: collectionId
            };
        });
        get().saveCollectionToSupabase(collectionId);
    },

    // Add a folder to a collection
    addFolder: (collectionId, name = 'New Folder') => {
        const folderId = uuidv4();
        set((state) => ({
            collections: state.collections.map(col =>
                col.id === collectionId
                    ? { ...col, items: [...col.items, { id: folderId, name, type: 'folder', items: [] }] }
                    : col
            )
        }));
        get().saveCollectionToSupabase(collectionId);
        return folderId;
    },

    // Add a request inside a folder
    addRequestToFolder: (collectionId, folderId) => {
        const newId = uuidv4();
        const newReq = {
            id: newId, name: 'New Request', type: 'request',
            method: 'GET', url: '', headers: [], params: [],
            body: { type: 'json', content: '' },
            preScript: '', postScript: '', assertions: [], collectionId
        };
        const insertInto = (items) => items.map(item => {
            if (item.id === folderId && item.type === 'folder') {
                return { ...item, items: [...(item.items || []), newReq] };
            }
            if (item.items) return { ...item, items: insertInto(item.items) };
            return item;
        });
        set((state) => ({
            collections: state.collections.map(col =>
                col.id === collectionId ? { ...col, items: insertInto(col.items) } : col
            ),
            activeTabs: [...state.activeTabs, newReq],
            activeTabId: newId,
            activeCollectionId: collectionId,
        }));
        get().saveCollectionToSupabase(collectionId);
    },

    // Move item to folder (null = collection root)
    moveItemToFolder: (itemId, targetFolderId, collectionId) => {
        set((state) => {
            let movedItem = null;
            const removeRecursive = (items) => {
                const result = [];
                for (const item of items) {
                    if (item.id === itemId) { movedItem = item; continue; }
                    if (item.items) {
                        result.push({ ...item, items: removeRecursive(item.items) });
                    } else {
                        result.push(item);
                    }
                }
                return result;
            };

            const insertInto = (items) => {
                if (!targetFolderId) return [...items, movedItem]; // Root level
                return items.map(item => {
                    if (item.id === targetFolderId && item.type === 'folder') {
                        return { ...item, items: [...(item.items || []), movedItem] };
                    }
                    if (item.items) return { ...item, items: insertInto(item.items) };
                    return item;
                });
            };

            return {
                collections: state.collections.map(col => {
                    if (col.id === collectionId) {
                        const stripped = removeRecursive(col.items);
                        if (!movedItem) return col;
                        return { ...col, items: insertInto(stripped) };
                    }
                    return col;
                })
            };
        });
        get().saveCollectionToSupabase(collectionId);
    },

    // Delete a request from collections, tabs, response cache, AND test suite references
    deleteRequest: (id) => {
        const colId = get().findCollectionForRequest(id);

        set((state) => {
            const removeRecursive = (items) =>
                items.filter(item => item.id !== id).map(item =>
                    item.items ? { ...item, items: removeRecursive(item.items) } : item
                );

            const newTabs = state.activeTabs.filter(t => t.id !== id);
            let newActiveId = state.activeTabId;
            if (state.activeTabId === id) {
                newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
            }
            const { [id]: _, ...restResponses } = state.responses;

            return {
                // Remove from items tree AND null out test suite references
                collections: state.collections.map(col => ({
                    ...col,
                    items: removeRecursive(col.items),
                    testSuites: (col.testSuites || []).map(suite => ({
                        ...suite,
                        tests: (suite.tests || []).map(t =>
                            t.requestId === id ? { ...t, requestId: null } : t
                        )
                    }))
                })),
                activeTabs: newTabs,
                activeTabId: newActiveId,
                responses: restResponses
            };
        });

        if (colId) get().saveCollectionToSupabase(colId);
    },

    // Rename a request or collection
    renameItem: (id, newName) => {
        set((state) => {
            const renameRecursive = (items) =>
                items.map(item => {
                    if (item.id === id) return { ...item, name: newName };
                    if (item.items) return { ...item, items: renameRecursive(item.items) };
                    return item;
                });

            return {
                collections: renameRecursive(state.collections),
                activeTabs: state.activeTabs.map(t => t.id === id ? { ...t, name: newName } : t)
            };
        });

        // Sync changes
        const state = get();
        const col = state.collections.find(c => c.id === id);
        if (col) {
            get().saveCollectionToSupabase(id);
        } else {
            const colId = get().findCollectionForRequest(id);
            if (colId) get().saveCollectionToSupabase(colId);
        }
    },

    // Duplicate a request
    duplicateRequest: (id) => {
        // We need parentColId. It was a local var in the previous function scope, effectively lost.
        // But we can find it again.
        // Actually, duplication puts it in the same collection as original.
        // We can find the new ID.
        // Optimization: we can just use findCollectionForRequest on the new ID?
        // But we don't know the new ID here easily? Wait, duplicateRequest generates newId inside set?
        // No, duplicateRequest had 'newId' in scope.
        // BUT 'set' callback scope is different.
        // The previous implementation of duplicateRequest in lines 427-454 has 'parentColId' in scope.
        // We need to capture it.
        // Let's rely on 'duplicateRequest's logic.
        // The 'set' was: set((state) => { ... logic ... return ... })
        // We can't easily hook into the return of set.
        // We should refactor duplicateRequest slightly to be like:
        /*
        duplicateRequest: (id) => {
            const state = get();
            // ... calculation ...
            const parentColId = ...
            set(...)
            get().saveCollectionToSupabase(parentColId)
        }
        */
        // For now, let's just find the collection of the original ID, because duplicate goes to same collection.
        const colId = get().findCollectionForRequest(id);
        set((state) => {
            let original = null;
            let parentColId = null;

            // Find the original request recursively (supports items inside folders)
            for (const col of state.collections) {
                const found = flattenItems(col.items).find(item => item.id === id);
                if (found) {
                    original = found;
                    parentColId = col.id;
                    break;
                }
            }
            if (!original) return {};

            const newId = uuidv4();
            const duplicate = { ...original, id: newId, name: `${original.name} (copy)`, collectionId: parentColId };

            // Insert duplicate next to the original (even inside folders)
            const insertDuplicateAfter = (items) => {
                const result = [];
                for (const item of items) {
                    result.push(item);
                    if (item.id === id) result.push(duplicate);
                    else if (item.items) {
                        result[result.length - 1] = { ...item, items: insertDuplicateAfter(item.items) };
                    }
                }
                return result;
            };

            return {
                collections: state.collections.map(col =>
                    col.id === parentColId
                        ? { ...col, items: insertDuplicateAfter(col.items) }
                        : col
                ),
                activeTabs: [...state.activeTabs, duplicate],
                activeTabId: newId
            };
        });
        if (colId) get().saveCollectionToSupabase(colId);
    },

    // Response management (per-request, not persisted)
    setResponseLoading: (id, loading) => set((state) => ({
        responses: {
            ...state.responses,
            [id]: { ...(state.responses[id] || {}), loading }
        }
    })),

    setResponseData: (id, data, time) => set((state) => ({
        responses: {
            ...state.responses,
            [id]: { data, time, loading: false }
        }
    })),

    // Request history (global audit trail of all individual executions)
    addRequestHistory: (entry) => set((state) => ({
        requestHistory: [
            { id: uuidv4(), timestamp: Date.now(), ...entry },
            ...state.requestHistory
        ].slice(0, 50) // Keep last 50
    })),
    clearRequestHistory: () => set({ requestHistory: [] }),

    // Collection Runner
    openRunner: (collectionId) => set((state) => {
        const col = state.collections.find(c => c.id === collectionId);
        if (!col) return {};
        return {
            runner: {
                collectionId,
                collectionName: col.name,
                requests: flattenItems(col.items, 'request'),
                running: false,
                progress: 0,
                results: [],
                summary: null
            }
        };
    }),

    // Open runner for a specific folder (subset of collection requests)
    openRunnerForFolder: (collectionId, folderId) => set((state) => {
        const col = state.collections.find(c => c.id === collectionId);
        if (!col) return {};
        const folder = findFolderById(col.items, folderId);
        if (!folder) return {};
        const requests = flattenItems(folder.items, 'request');
        if (requests.length === 0) return {};
        return {
            runner: {
                collectionId,
                folderId,
                collectionName: `${col.name} › ${folder.name}`,
                requests,
                running: false,
                progress: 0,
                results: [],
                summary: null
            }
        };
    }),

    // Open runner in test-suite mode
    openRunnerForTestSuite: (colId, suite) => set(() => ({
        runner: {
            collectionId: colId,
            collectionName: suite.test_suite_name || 'Test Suite',
            requests: (suite.tests || []).map(t => ({
                id: uuidv4(),
                name: t.name,
                type: 'request',
                method: t.method || 'GET',
                url: t.endpoint || '',
                headers: Object.entries(t.headers || {}).map(([k, v]) => ({ key: k, value: v, enabled: true })),
                params: [],
                body: { type: 'json', content: t.payload ? JSON.stringify(t.payload, null, 2) : '' },
                expected_status: t.expected_status,
                category: t.category,
            })),
            running: false,
            progress: 0,
            results: [],
            summary: null,
            isTestSuite: true,
            suiteId: suite.id,
        }
    })),

    // Environment management (with Supabase sync)
    setActiveEnv: (name) => set({ activeEnv: name }),
    addEnvironment: (name) => {
        set((state) => ({
            environments: [...state.environments, { name, vars: [] }],
            activeEnv: name
        }));
        get().saveEnvironmentToSupabase(name);
    },
    deleteEnvironment: (name) => {
        if (name === 'Global') return;
        set((state) => ({
            environments: state.environments.filter(e => e.name !== name),
            activeEnv: state.activeEnv === name ? 'Global' : state.activeEnv
        }));
        get().deleteEnvironmentFromSupabase(name);
    },
    updateEnvVars: (envName, vars) => {
        set((state) => ({
            environments: state.environments.map(e =>
                e.name === envName ? { ...e, vars } : e
            )
        }));
        get().saveEnvironmentToSupabase(envName);
    },
    // Chain variable management
    setChainVar: (key, value) => set((state) => ({
        chainVars: { ...state.chainVars, [key]: value }
    })),
    clearChainVars: () => set({ chainVars: {} }),

    // Resolve {{variable}} placeholders using active environment + Global + chain vars
    // Priority: dynamic $vars > chain vars > active env > Global
    resolveVariables: (text) => {
        if (!text || typeof text !== 'string') return text;
        const state = useWorkspaceStore.getState();
        // Merge Global vars first, then active env vars, then chain vars (highest priority)
        const globalEnv = state.environments.find(e => e.name === 'Global');
        const activeEnv = state.environments.find(e => e.name === state.activeEnv);
        const varMap = {};
        (globalEnv?.vars || []).forEach(v => { if (v.enabled !== false && v.key) varMap[v.key] = v.value; });
        if (activeEnv && activeEnv.name !== 'Global') {
            (activeEnv.vars || []).forEach(v => { if (v.enabled !== false && v.key) varMap[v.key] = v.value; });
        }
        // Chain vars override environment vars
        Object.entries(state.chainVars || {}).forEach(([k, v]) => { varMap[k] = v; });
        return text.replace(/\{\{([\w$]+)\}\}/g, (match, key) => {
            // Built-in dynamic variables ($ prefix) — generated fresh each call
            if (key.startsWith('$')) {
                const val = resolveDynamicVar(key);
                if (val !== undefined) return val;
            }
            return varMap[key] !== undefined ? varMap[key] : match;
        });
    },

    closeRunner: () => set({ runner: null }),
    setRunnerState: (updates) => set((state) => ({
        runner: state.runner ? { ...state.runner, ...updates } : null
    })),

    // Import from OpenAPI/Swagger spec — adds endpoints to the active collection
    importFromOpenApiSpec: (specString, baseUrlOverride) => {
        let spec;
        try {
            spec = JSON.parse(specString);
        } catch {
            try {
                spec = yaml.load(specString);
                if (!spec || typeof spec !== 'object') throw new Error('Not a valid object');
            } catch {
                return { error: 'Invalid spec. Paste a valid OpenAPI spec in JSON or YAML format.' };
            }
        }

        const baseUrl = baseUrlOverride || spec.servers?.[0]?.url || (spec.host ? `https://${spec.host}${spec.basePath || ''}` : '');
        const title = spec.info?.title || 'Imported API';
        const paths = spec.paths || {};

        // Generate example value from a JSON schema node
        const genExample = (schema, depth = 0) => {
            if (!schema || depth > 5) return 'string';
            if (schema.$ref) {
                const parts = schema.$ref.replace('#/', '').split('/');
                let resolved = spec;
                for (const p of parts) resolved = resolved?.[p];
                return genExample(resolved, depth + 1);
            }
            if (schema.example !== undefined) return schema.example;
            switch (schema.type) {
                case 'string':
                    if (schema.format === 'email') return 'user@example.com';
                    if (schema.format === 'date-time') return new Date().toISOString();
                    if (schema.format === 'date') return '2024-01-01';
                    if (schema.enum) return schema.enum[0];
                    return schema.default || 'string';
                case 'integer': case 'number':
                    return schema.default ?? schema.minimum ?? 0;
                case 'boolean':
                    return schema.default ?? true;
                case 'array':
                    return [genExample(schema.items, depth + 1)];
                case 'object': {
                    if (!schema.properties) return {};
                    const obj = {};
                    for (const [k, v] of Object.entries(schema.properties)) obj[k] = genExample(v, depth + 1);
                    return obj;
                }
                default:
                    if (schema.properties) {
                        const obj = {};
                        for (const [k, v] of Object.entries(schema.properties)) obj[k] = genExample(v, depth + 1);
                        return obj;
                    }
                    return 'string';
            }
        };

        const METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
        const items = [];

        for (const [path, pathItem] of Object.entries(paths)) {
            for (const method of METHODS) {
                const op = pathItem[method];
                if (!op) continue;

                const fullUrl = `${baseUrl}${path}`;
                const name = op.summary || op.operationId || `${method.toUpperCase()} ${path}`;

                // Extract parameters
                const params = [];
                const headers = [];
                const mergedParams = [...(pathItem.parameters || []), ...(op.parameters || [])];
                const seenParams = new Set();
                const allParams = mergedParams.filter(p => { const k = `${p.in}:${p.name}`; if (seenParams.has(k)) return false; seenParams.add(k); return true; });
                for (const param of allParams) {
                    const val = param.example ?? param.schema?.example ?? '';
                    if (param.in === 'query') {
                        params.push({ key: param.name, value: String(val), enabled: !!param.required });
                    } else if (param.in === 'header') {
                        headers.push({ key: param.name, value: String(val), enabled: true });
                    }
                }

                // Extract request body
                let bodyContent = '';
                const rb = op.requestBody;
                if (rb) {
                    const jsonSchema = rb.content?.['application/json']?.schema;
                    if (jsonSchema) {
                        const example = rb.content['application/json'].example || genExample(jsonSchema);
                        bodyContent = JSON.stringify(example, null, 2);
                    }
                }

                // Build URL with enabled query params
                let displayUrl = fullUrl;
                const ep = params.filter(p => p.enabled && p.key);
                if (ep.length > 0) displayUrl += '?' + ep.map(p => `${p.key}=${p.value || ''}`).join('&');

                items.push({
                    id: uuidv4(), name, type: 'request',
                    method: method.toUpperCase(), url: displayUrl,
                    headers, params,
                    body: { type: 'json', content: bodyContent },
                    preScript: '', postScript: '', assertions: [],
                    authType: 'none', authToken: '', authKeyName: '', authKeyValue: '',
                    authUsername: '', authPassword: ''
                });
            }
        }

        if (items.length === 0) return { error: 'No endpoints found in the spec.' };

        // Auto-organize into folders by URL path segment (e.g., /auth/login → "Auth" folder)
        const structured = groupItemsIntoFolders(items);

        // Always import into the active collection
        const state = get();
        const targetId = state.activeCollectionId;
        const targetCol = targetId ? state.collections.find(c => c.id === targetId) : null;

        if (targetCol) {
            set((s) => ({
                collections: s.collections.map(col =>
                    col.id === targetId
                        ? { ...col, items: [...col.items, ...structured] }
                        : col
                )
            }));
            get().saveCollectionToSupabase(targetId);
            return { success: true, count: items.length, title: targetCol.name };
        } else {
            // Fallback: create new collection if somehow no active collection
            const newColId = uuidv4();
            set((s) => ({
                collections: [...s.collections, {
                    id: newColId, name: title, type: 'collection', items: structured,
                    chatMessages: [], openApiSpec: specString, runHistory: [], testSuites: [],
                }],
                activeCollectionId: newColId
            }));
            get().saveCollectionToSupabase(newColId);
            return { success: true, count: items.length, title };
        }
    },

    // Create request from AI suggestion — auto-targets active collection + optional folder
    createRequestFromAI: ({ method, url, body, name, collectionId, folderId }) => {
        const state = get();
        const targetCol = collectionId || state.activeCollectionId || state.collections[0]?.id;
        // Use provided folderId or the currently active folder from sidebar
        const targetFolder = folderId || state.activeFolderId || null;
        const newId = uuidv4();
        const rawUrl = url || '';

        // Parse query params from URL automatically
        const parsedParams = [];
        try {
            const urlObj = new URL(rawUrl);
            urlObj.searchParams.forEach((v, k) => {
                parsedParams.push({ key: k, value: v, enabled: true });
            });
        } catch {
            const qIdx = rawUrl.indexOf('?');
            if (qIdx !== -1) {
                rawUrl.slice(qIdx + 1).split('&').forEach(pair => {
                    const [k, ...rest] = pair.split('=');
                    if (k) parsedParams.push({ key: k, value: rest.join('='), enabled: true });
                });
            }
        }

        const newReq = {
            id: newId,
            name: name || 'New Request',
            type: 'request',
            method: method || 'POST',
            url: rawUrl,
            headers: [],
            params: parsedParams,
            body: { type: 'json', content: typeof body === 'string' ? body : JSON.stringify(body ?? null, null, 2) },
            preScript: '', postScript: '', assertions: [],
            authType: 'none', authToken: '', authKeyName: '', authKeyValue: '',
            authUsername: '', authPassword: '',
            collectionId: targetCol
        };

        set((s) => {
            const insertIntoFolder = (items) => items.map(item => {
                if (item.id === targetFolder && item.type === 'folder') {
                    return { ...item, items: [...(item.items || []), newReq] };
                }
                if (item.items) return { ...item, items: insertIntoFolder(item.items) };
                return item;
            });

            const newCollections = s.collections.map(col => {
                if (col.id === targetCol) {
                    // If a folder is targeted, insert inside it; otherwise push to root
                    return targetFolder
                        ? { ...col, items: insertIntoFolder(col.items) }
                        : { ...col, items: [...col.items, newReq] };
                }
                return col;
            });
            return {
                collections: newCollections,
                activeTabs: [...s.activeTabs, newReq],
                activeTabId: newId,
                activeCollectionId: targetCol
            };
        });
        get().saveCollectionToSupabase(targetCol);
    }

}), {
    name: 'gemini-workspace-storage',
    version: 15,
    partialize: (state) => {
        // Exclude transient runtime data from persistence
        // _realtimeChannel contains circular refs (RealtimeChannel → socket → channels → channel)
        // user is restored by initializeAuth on app load
        const {
            responses: _responses,
            runner: _runner,
            profile: _profile,
            _realtimeChannel,
            user: _user,
            pendingSuggestions: _ps,
            contractResults: _cr,
            activeFolderId: _af,
            ...persisted
        } = state;

        // S1.8: Strip secret env var values from localStorage (memory-only)
        persisted.environments = (persisted.environments || []).map(env => ({
            ...env,
            vars: (env.vars || []).map(v =>
                v.isSecret ? { ...v, value: '' } : v
            ),
        }));

        // S1.8: Strip sensitive auth credential values from collections and request items.
        // Auth config (authType, authKeyName, authUsername, URLs) is kept — only actual
        // secrets (tokens, passwords, keys, OAuth secrets) are redacted from localStorage.
        const SENSITIVE_AUTH_KEYS = [
            'authToken', 'authPassword', 'authKeyValue',
            'oauthClientSecret', 'oauthAccessToken', 'oauthRefreshToken',
            'autoAuthToken', 'autoAuthBody',
        ];
        const stripSecrets = (obj) => {
            const cleaned = { ...obj };
            for (const key of SENSITIVE_AUTH_KEYS) {
                if (key in cleaned) cleaned[key] = '';
            }
            return cleaned;
        };
        const stripItemSecrets = (items) => (items || []).map(item => {
            const cleaned = stripSecrets(item);
            if (cleaned.items) cleaned.items = stripItemSecrets(cleaned.items);
            return cleaned;
        });
        persisted.collections = (persisted.collections || []).map(col => {
            const cleaned = stripSecrets(col);
            cleaned.items = stripItemSecrets(col.items);
            return cleaned;
        });

        return persisted;
    },
    migrate: (persisted, version) => {
        if (version < 2) {
            // v1 → v2: Move root-level chat/spec/runHistory into each collection
            const rootChat = persisted.chatMessages || [];
            const rootSpec = persisted.openApiSpec || '';
            const rootRunHistory = persisted.runHistory || [];

            persisted.collections = (persisted.collections || []).map(col => ({
                ...col,
                chatMessages: col.chatMessages || rootChat,
                openApiSpec: col.openApiSpec || rootSpec,
                runHistory: col.runHistory || rootRunHistory,
                testSuites: col.testSuites || [],
            }));

            // Clean up removed root-level fields
            delete persisted.chatMessages;
            delete persisted.openApiSpec;
            delete persisted.runHistory;
            delete persisted.targetCollectionId;
        }
        if (version < 3) {
            // v2 → v3: Add baseUrl field to each collection
            persisted.collections = (persisted.collections || []).map(col => ({
                ...col,
                baseUrl: col.baseUrl || '',
            }));
        }
        if (version < 4) {
            // v3 → v4: Add currentView, darkMode
            persisted.currentView = persisted.currentView || 'dashboard';
            persisted.darkMode = persisted.darkMode || false;
        }
        if (version < 5) {
            // v4 → v5: Add preScript/postScript to all existing requests
            const addScripts = (items) => (items || []).map(item => ({
                ...item,
                preScript: item.preScript || '',
                postScript: item.postScript || '',
                ...(item.items ? { items: addScripts(item.items) } : {}),
            }));
            persisted.collections = (persisted.collections || []).map(col => ({
                ...col,
                items: addScripts(col.items),
            }));
        }
        if (version < 6) {
            // v5 → v6: Add assertions array to all existing requests
            const addAssertions = (items) => (items || []).map(item => ({
                ...item,
                assertions: item.assertions || [],
                ...(item.items ? { items: addAssertions(item.items) } : {}),
            }));
            persisted.collections = (persisted.collections || []).map(col => ({
                ...col,
                items: addAssertions(col.items),
            }));
        }
        if (version < 7) {
            // v6 → v7: Add OAuth 2.0 fields (legacy migration — kept for compatibility)
            const addOAuth = (items) => (items || []).map(item => ({
                ...item,
                oauthGrantType: item.oauthGrantType || '',
                oauthAuthUrl: item.oauthAuthUrl || '',
                oauthTokenUrl: item.oauthTokenUrl || '',
                oauthClientId: item.oauthClientId || '',
                oauthClientSecret: item.oauthClientSecret || '',
                oauthScope: item.oauthScope || '',
                oauthAccessToken: item.oauthAccessToken || '',
                oauthRefreshToken: item.oauthRefreshToken || '',
                oauthTokenExpiry: item.oauthTokenExpiry || null,
                ...(item.items ? { items: addOAuth(item.items) } : {}),
            }));
            persisted.collections = (persisted.collections || []).map(col => ({
                ...col,
                items: addOAuth(col.items),
            }));
        }
        if (version < 8) {
            // v7 → v8: Add Auto-Auth fields, convert oauth2 → auto-auth
            const addAutoAuth = (items) => (items || []).map(item => ({
                ...item,
                autoAuthLoginUrl: item.autoAuthLoginUrl || '',
                autoAuthMethod: item.autoAuthMethod || 'POST',
                autoAuthBody: item.autoAuthBody || '',
                autoAuthTokenPath: item.autoAuthTokenPath || 'token',
                autoAuthToken: item.autoAuthToken || '',
                autoAuthTokenTime: item.autoAuthTokenTime || null,
                // Convert old oauth2 authType to auto-auth
                authType: item.authType === 'oauth2' ? 'auto-auth' : (item.authType || 'none'),
                ...(item.items ? { items: addAutoAuth(item.items) } : {}),
            }));
            persisted.collections = (persisted.collections || []).map(col => ({
                ...col,
                items: addAutoAuth(col.items),
            }));
        }
        if (version < 9) {
            // v8 → v9: Add collection-level pre/post scripts
            persisted.collections = (persisted.collections || []).map(col => ({
                ...col,
                preScript: col.preScript || '',
                postScript: col.postScript || '',
            }));
        }
        if (version < 10) {
            // v9 → v10: Add forceCollectionAuth to all collections
            persisted.collections = (persisted.collections || []).map(col => ({
                ...col,
                forceCollectionAuth: col.forceCollectionAuth || false,
            }));
        }
        if (version < 11) {
            // v10 → v11: Add resizable panel widths
            persisted.sidebarWidth = persisted.sidebarWidth || 256;
            persisted.intelligenceWidth = persisted.intelligenceWidth || 320;
            persisted.editorSplitRatio = persisted.editorSplitRatio || 0.5;
        }
        if (version < 12) {
            // v11 → v12: Add test-request linking (id, requestId, endpointSignature)
            persisted.collections = (persisted.collections || []).map(col => {
                // Flatten all requests for auto-linking
                const allReqs = [];
                const flatten = (items) => {
                    for (const item of (items || [])) {
                        if (item.type === 'request') allReqs.push(item);
                        if (item.items) flatten(item.items);
                    }
                };
                flatten(col.items);

                const migratedSuites = (col.testSuites || []).map(suite => ({
                    ...suite,
                    source: suite.source || 'ai',
                    folderId: suite.folderId || null,
                    tests: (suite.tests || []).map(test => {
                        const testId = test.id || crypto.randomUUID();
                        const method = (test.method || 'GET').toUpperCase();
                        let path = test.endpoint || '';
                        if (col.baseUrl && path.startsWith(col.baseUrl)) path = path.slice(col.baseUrl.length);
                        try { path = new URL(path.startsWith('http') ? path : `https://x${path}`).pathname; } catch { /* keep */ }
                        const sig = `${method}::${path}`;

                        // Auto-link to matching request
                        let matchedId = null;
                        for (const req of allReqs) {
                            let rp = req.url || '';
                            if (col.baseUrl && rp.startsWith(col.baseUrl)) rp = rp.slice(col.baseUrl.length);
                            try { rp = new URL(rp.startsWith('http') ? rp : `https://x${rp}`).pathname; } catch { /* keep */ }
                            if (`${(req.method || 'GET').toUpperCase()}::${rp}` === sig) { matchedId = req.id; break; }
                        }
                        return { ...test, id: testId, requestId: matchedId, endpointSignature: sig, lastResult: test.lastResult || null };
                    }),
                }));
                return { ...col, testSuites: migratedSuites };
            });
        }
        if (version < 13) {
            // v12 → v13: Add isSecret flag to environment variables
            persisted.environments = (persisted.environments || []).map(env => ({
                ...env,
                vars: (env.vars || []).map(v => ({
                    ...v,
                    isSecret: v.isSecret || false,
                })),
            }));
        }
        if (version < 14) {
            // v13 → v14: Add subscription state
            persisted.subscription = persisted.subscription || { plan: 'free', status: 'active', expiresAt: null };
        }
        if (version < 15) {
            // v14 → v15: Add dismissedOnboarding for persistent hero banner
            persisted.dismissedOnboarding = persisted.dismissedOnboarding ?? false;
        }
        return persisted;
    },
}));
