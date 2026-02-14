import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../utils/supabaseClient';

/**
 * Workspace Store (The "Brain" of the App)
 *
 * v2 Data Model: Collection = Workspace
 * Each collection owns its own chatMessages, openApiSpec, runHistory, testSuites.
 */
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
                    body: { type: 'json', content: '' }
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

    // Individual request history — global audit trail (persisted, capped at 50)
    // Individual request history — global audit trail (persisted, capped at 50)
    requestHistory: [],

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
            // Merge DB columns (id, name) with the JSON blob (items, etc)
            const loaded = data.map(row => ({
                ...row.data,
                id: row.id,
                name: row.name,
                owner_id: row.owner_id
            }));

            if (loaded.length > 0) {
                set({ collections: loaded, activeCollectionId: loaded[0].id });
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

        const { id, name, owner_id: _owner_id, ...rest } = col;

        await supabase.from('collections').upsert({
            id,
            name,
            owner_id: user.id,
            data: rest,
            updated_at: new Date().toISOString()
        });
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

        const channel = supabase
            .channel('collections-changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'collections' }, () => {
                // Re-fetch collections when any change is detected
                get().fetchRemoteCollections();
            })
            .subscribe();

        set({ _realtimeChannel: channel });
    },

    // --- Helpers ---

    getActiveCollection: () => {
        const state = get();
        return state.collections.find(c => c.id === state.activeCollectionId) || null;
    },

    // Generic collection updater
    updateCollection: (colId, updates) => {
        set((state) => ({
            collections: state.collections.map(col =>
                col.id === colId ? { ...col, ...updates } : col
            )
        }));
        // Trigger sync
        get().saveCollectionToSupabase(colId);
    },

    // --- Per-Collection Chat Actions ---

    addCollectionChatMessage: (msg) => set((state) => {
        const colId = state.activeCollectionId;
        return {
            collections: state.collections.map(col =>
                col.id === colId
                    ? { ...col, chatMessages: [...(col.chatMessages || []), msg] }
                    : col
            )
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
        const colId = state.activeCollectionId;
        return {
            collections: state.collections.map(col =>
                col.id === colId
                    ? {
                        ...col,
                        runHistory: [
                            { id: uuidv4(), timestamp: Date.now(), ...run },
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

    addTestSuite: (colId, suite) => set((state) => ({
        collections: state.collections.map(col =>
            col.id === colId
                ? {
                    ...col,
                    testSuites: [
                        { id: uuidv4(), createdAt: Date.now(), ...suite },
                        ...(col.testSuites || [])
                    ]
                }
                : col
        )
    })),

    deleteTestSuite: (colId, suiteId) => set((state) => ({
        collections: state.collections.map(col =>
            col.id === colId
                ? { ...col, testSuites: (col.testSuites || []).filter(s => s.id !== suiteId) }
                : col
        )
    })),

    // --- Actions ---

    // Tabs
    openTab: (item) => set((state) => {
        // Find which collection this request belongs to
        let colId = item.collectionId || null;
        if (!colId) {
            for (const col of state.collections) {
                if ((col.items || []).some(i => i.id === item.id)) {
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

    // Find which collection a request belongs to
    findCollectionForRequest: (reqId) => {
        const state = get();
        for (const col of state.collections) {
            const found = (col.items || []).some(item => item.id === reqId);
            if (found) return col.id;
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
            }],
            activeCollectionId: newId
        }));
        get().saveCollectionToSupabase(newId);
    },

    // Add New WebSocket to a specific collection
    addWebSocket: (collectionId = 'default-col') => set((state) => {
        const newId = uuidv4();
        const newWs = {
            id: newId,
            name: 'New WebSocket',
            type: 'websocket',
            method: 'WS',
            url: 'wss://',
            collectionId
        };

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
    }),

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
        if (colId) get().saveCollectionToSupabase(colId);
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

    // Delete a request from collections, tabs, and response cache
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
                collections: removeRecursive(state.collections),
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

            // Find the original request and its parent collection
            for (const col of state.collections) {
                const found = (col.items || []).find(item => item.id === id);
                if (found) {
                    original = found;
                    parentColId = col.id;
                    break;
                }
            }
            if (!original) return {};

            const newId = uuidv4();
            const duplicate = { ...original, id: newId, name: `${original.name} (copy)`, collectionId: parentColId };

            return {
                collections: state.collections.map(col =>
                    col.id === parentColId
                        ? { ...col, items: [...col.items, duplicate] }
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
                requests: (col.items || []).filter(i => i.type === 'request'),
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
    // Priority: chain vars > active env > Global
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
        return text.replace(/\{\{(\w+)\}\}/g, (match, key) => varMap[key] !== undefined ? varMap[key] : match);
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
            return { error: 'Invalid JSON. Paste a valid OpenAPI spec in JSON format.' };
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
                for (const param of (op.parameters || pathItem.parameters || [])) {
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
                    body: { type: 'json', content: bodyContent }
                });
            }
        }

        if (items.length === 0) return { error: 'No endpoints found in the spec.' };

        // Always import into the active collection
        const state = get();
        const targetId = state.activeCollectionId;
        const targetCol = targetId ? state.collections.find(c => c.id === targetId) : null;

        if (targetCol) {
            set((s) => ({
                collections: s.collections.map(col =>
                    col.id === targetId
                        ? { ...col, items: [...col.items, ...items] }
                        : col
                )
            }));
            return { success: true, count: items.length, title: targetCol.name };
        } else {
            // Fallback: create new collection if somehow no active collection
            const newColId = uuidv4();
            set((s) => ({
                collections: [...s.collections, {
                    id: newColId, name: title, type: 'collection', items,
                    chatMessages: [], openApiSpec: specString, runHistory: [], testSuites: [],
                }],
                activeCollectionId: newColId
            }));
            return { success: true, count: items.length, title };
        }
    },

    // Create request from AI suggestion — auto-targets active collection
    createRequestFromAI: ({ method, url, body, name, collectionId }) => set((state) => {
        const newId = uuidv4();
        const rawUrl = url || '';
        const targetCol = collectionId || state.activeCollectionId || state.collections[0]?.id;

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
            body: { type: 'json', content: typeof body === 'string' ? body : JSON.stringify(body, null, 2) },
            collectionId: targetCol
        };

        const newCollections = state.collections.map(col => {
            if (col.id === targetCol) {
                return { ...col, items: [...col.items, newReq] };
            }
            return col;
        });

        return {
            collections: newCollections,
            activeTabs: [...state.activeTabs, newReq],
            activeTabId: newId,
            activeCollectionId: targetCol
        };
    })

}), {
    name: 'gemini-workspace-storage',
    version: 8,
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
            ...persisted
        } = state;
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
        return persisted;
    },
}));
