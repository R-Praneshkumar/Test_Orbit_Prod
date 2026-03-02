import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock supabase before importing the store (vi.mock is auto-hoisted)
vi.mock('../utils/supabaseClient', () => ({
    supabase: null
}));

// Bypass zustand persist middleware — tests don't need localStorage
vi.mock('zustand/middleware', async () => {
    const actual = await vi.importActual('zustand/middleware');
    return {
        ...actual,
        persist: (fn) => fn,
    };
});

import {
    flattenItems,
    flattenItemsWithPath,
    findFolderById,
    buildEndpointSignature,
    matchTestToRequest,
    groupTestsByFolder,
    useWorkspaceStore,
} from '../store/workspaceStore';

// ─── Test Fixtures ──────────────────────────────────────────────────

const NESTED_ITEMS = [
    { id: 'r1', name: 'Get Users', type: 'request', method: 'GET', url: '/users' },
    {
        id: 'f1', name: 'Auth', type: 'folder', items: [
            { id: 'r2', name: 'Login', type: 'request', method: 'POST', url: '/auth/login' },
            { id: 'r3', name: 'Register', type: 'request', method: 'POST', url: '/auth/register' },
            {
                id: 'f2', name: 'OAuth', type: 'folder', items: [
                    { id: 'r4', name: 'Google SSO', type: 'request', method: 'GET', url: '/auth/google' },
                ]
            },
        ]
    },
    { id: 'ws1', name: 'Live Feed', type: 'websocket', method: 'WS', url: 'wss://feed' },
];

// Reset store data before each test (merge, not replace — preserves action functions)
function resetStore() {
    useWorkspaceStore.setState({
        collections: [{
            id: 'col-1',
            name: 'Test Collection',
            type: 'collection',
            items: [],
            chatMessages: [],
            openApiSpec: '',
            baseUrl: '',
            runHistory: [],
            testSuites: [],
            authType: 'none',
            authToken: '',
            authUsername: '',
            authPassword: '',
            authKeyName: '',
            authKeyValue: '',
            forceCollectionAuth: false,
            preScript: '',
            postScript: '',
        }],
        activeCollectionId: 'col-1',
        activeTabs: [],
        activeTabId: null,
        currentView: 'dashboard',
        darkMode: false,
        localMode: false,
        sidebarCollapsed: false,
        intelligenceCollapsed: false,
        sidebarWidth: 256,
        intelligenceWidth: 320,
        editorSplitRatio: 0.5,
        environments: [
            { name: 'Global', vars: [{ key: 'baseUrl', value: 'https://api.example.com', enabled: true }] },
        ],
        activeEnv: 'Global',
        chainVars: {},
        responses: {},
        runner: null,
        user: null,
        profile: null,
        requestHistory: [],
        pendingSuggestions: {},
        contractResults: {},
        activeFolderId: null,
        activeTour: null,
        tourStep: 0,
        hasSeenWelcomeTour: false,
        activeTutorial: null,
    });
}

// ─── flattenItems ───────────────────────────────────────────────────

describe('flattenItems', () => {
    it('returns empty array for null/undefined input', () => {
        expect(flattenItems(null)).toEqual([]);
        expect(flattenItems(undefined)).toEqual([]);
    });

    it('returns empty array for empty array', () => {
        expect(flattenItems([])).toEqual([]);
    });

    it('returns all items without type filter', () => {
        const result = flattenItems(NESTED_ITEMS);
        expect(result).toHaveLength(7); // r1, f1, r2, r3, f2, r4, ws1
    });

    it('filters by request type', () => {
        const result = flattenItems(NESTED_ITEMS, 'request');
        expect(result).toHaveLength(4); // r1, r2, r3, r4
        expect(result.map(r => r.id)).toEqual(['r1', 'r2', 'r3', 'r4']);
    });

    it('filters by folder type', () => {
        const result = flattenItems(NESTED_ITEMS, 'folder');
        expect(result).toHaveLength(2); // f1, f2
    });

    it('filters by websocket type', () => {
        const result = flattenItems(NESTED_ITEMS, 'websocket');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('ws1');
    });

    it('flattens deeply nested folders', () => {
        const deep = [{
            id: 'f', type: 'folder', items: [{
                id: 'f2', type: 'folder', items: [{
                    id: 'f3', type: 'folder', items: [
                        { id: 'r', type: 'request' }
                    ]
                }]
            }]
        }];
        expect(flattenItems(deep, 'request')).toHaveLength(1);
        expect(flattenItems(deep, 'folder')).toHaveLength(3);
    });
});

// ─── flattenItemsWithPath ───────────────────────────────────────────

describe('flattenItemsWithPath', () => {
    it('returns empty array for null input', () => {
        expect(flattenItemsWithPath(null, 'request')).toEqual([]);
    });

    it('returns items with empty folder path at root', () => {
        const result = flattenItemsWithPath(NESTED_ITEMS, 'request');
        const r1 = result.find(r => r.item.id === 'r1');
        expect(r1.folderPath).toEqual([]);
        expect(r1.folderId).toBeNull();
    });

    it('includes folder name in path for nested items', () => {
        const result = flattenItemsWithPath(NESTED_ITEMS, 'request');
        const r2 = result.find(r => r.item.id === 'r2');
        expect(r2.folderPath).toEqual(['Auth']);
        expect(r2.folderId).toBe('f1');
    });

    it('builds multi-level paths for deeply nested items', () => {
        const result = flattenItemsWithPath(NESTED_ITEMS, 'request');
        const r4 = result.find(r => r.item.id === 'r4');
        expect(r4.folderPath).toEqual(['Auth', 'OAuth']);
        expect(r4.folderId).toBe('f2');
    });

    it('returns correct count with type filter', () => {
        const result = flattenItemsWithPath(NESTED_ITEMS, 'request');
        expect(result).toHaveLength(4);
    });
});

// ─── findFolderById ─────────────────────────────────────────────────

describe('findFolderById', () => {
    it('returns null for null/empty items', () => {
        expect(findFolderById(null, 'f1')).toBeNull();
        expect(findFolderById([], 'f1')).toBeNull();
    });

    it('finds a top-level folder', () => {
        const folder = findFolderById(NESTED_ITEMS, 'f1');
        expect(folder).toBeDefined();
        expect(folder.name).toBe('Auth');
    });

    it('finds a deeply nested folder', () => {
        const folder = findFolderById(NESTED_ITEMS, 'f2');
        expect(folder).toBeDefined();
        expect(folder.name).toBe('OAuth');
    });

    it('returns null for non-existent folder', () => {
        expect(findFolderById(NESTED_ITEMS, 'f99')).toBeNull();
    });

    it('does not match requests as folders', () => {
        expect(findFolderById(NESTED_ITEMS, 'r1')).toBeNull();
    });
});

// ─── buildEndpointSignature ─────────────────────────────────────────

describe('buildEndpointSignature', () => {
    it('builds METHOD::path format', () => {
        expect(buildEndpointSignature('GET', '/users')).toBe('GET::/users');
    });

    it('uppercases method', () => {
        expect(buildEndpointSignature('post', '/users')).toBe('POST::/users');
    });

    it('defaults to GET when method is null', () => {
        expect(buildEndpointSignature(null, '/test')).toBe('GET::/test');
    });

    it('strips base URL from endpoint', () => {
        expect(buildEndpointSignature('GET', 'https://api.com/v1/users', 'https://api.com/v1'))
            .toBe('GET::/users');
    });

    it('extracts pathname from full URL', () => {
        expect(buildEndpointSignature('POST', 'https://api.com/v1/users'))
            .toBe('POST::/v1/users');
    });

    it('handles empty endpoint', () => {
        const sig = buildEndpointSignature('GET', '');
        expect(sig).toContain('GET::');
    });
});

// ─── matchTestToRequest ─────────────────────────────────────────────

describe('matchTestToRequest', () => {
    const requests = [
        { id: 'r1', method: 'GET', url: 'https://api.com/users' },
        { id: 'r2', method: 'POST', url: 'https://api.com/auth/login' },
        { id: 'r3', method: 'PUT', url: 'https://api.com/users/1' },
    ];

    it('matches by requestId first', () => {
        const test = { requestId: 'r3', method: 'GET', endpoint: '/other' };
        expect(matchTestToRequest(test, requests).id).toBe('r3');
    });

    it('matches by endpoint signature', () => {
        const test = { method: 'POST', endpoint: 'https://api.com/auth/login' };
        expect(matchTestToRequest(test, requests).id).toBe('r2');
    });

    it('matches by fuzzy tail (last 2 path segments)', () => {
        const test = { method: 'PUT', endpoint: 'https://other.com/api/v2/users/1' };
        expect(matchTestToRequest(test, requests).id).toBe('r3');
    });

    it('returns null when no match found', () => {
        const test = { method: 'DELETE', endpoint: '/orders' };
        expect(matchTestToRequest(test, requests)).toBeNull();
    });

    it('returns null for unmatched requestId with no signature match', () => {
        const test = { requestId: 'r999', method: 'DELETE', endpoint: '/orders' };
        expect(matchTestToRequest(test, requests)).toBeNull();
    });

    it('defaults method to GET', () => {
        const test = { endpoint: 'https://api.com/users' };
        expect(matchTestToRequest(test, requests).id).toBe('r1');
    });
});

// ─── groupTestsByFolder ─────────────────────────────────────────────

describe('groupTestsByFolder', () => {
    it('groups tests by their matched request folder', () => {
        const items = [
            { id: 'r1', name: 'Get Users', type: 'request', method: 'GET', url: '/users' },
            {
                id: 'f1', name: 'Auth', type: 'folder', items: [
                    { id: 'r2', name: 'Login', type: 'request', method: 'POST', url: '/auth/login' },
                ]
            },
        ];
        const tests = [
            { method: 'GET', endpoint: '/users' },
            { method: 'POST', endpoint: '/auth/login' },
        ];
        const groups = groupTestsByFolder(tests, items);
        expect(groups.get('(root)')).toHaveLength(1);
        expect(groups.get('Auth')).toHaveLength(1);
    });

    it('puts unmatched tests in (unlinked)', () => {
        const tests = [{ method: 'DELETE', endpoint: '/nonexistent' }];
        const groups = groupTestsByFolder(tests, []);
        expect(groups.get('(unlinked)')).toHaveLength(1);
    });
});

// ─── Store: Collection CRUD ─────────────────────────────────────────

describe('workspaceStore — collection CRUD', () => {
    beforeEach(resetStore);

    it('has initial collection', () => {
        const { collections } = useWorkspaceStore.getState();
        expect(collections).toHaveLength(1);
        expect(collections[0].id).toBe('col-1');
    });

    it('addCollection creates a new collection with all fields', () => {
        useWorkspaceStore.getState().addCollection('API Tests');
        const { collections, activeCollectionId } = useWorkspaceStore.getState();
        expect(collections).toHaveLength(2);
        const added = collections[1];
        expect(added.name).toBe('API Tests');
        expect(added.type).toBe('collection');
        expect(added.items).toEqual([]);
        expect(added.chatMessages).toEqual([]);
        expect(added.runHistory).toEqual([]);
        expect(added.testSuites).toEqual([]);
        expect(added.authType).toBe('none');
        expect(added.forceCollectionAuth).toBe(false);
        expect(activeCollectionId).toBe(added.id);
    });

    it('updateCollection updates specific fields', () => {
        useWorkspaceStore.getState().updateCollection('col-1', { name: 'Renamed', baseUrl: 'https://api.new.com' });
        const col = useWorkspaceStore.getState().collections[0];
        expect(col.name).toBe('Renamed');
        expect(col.baseUrl).toBe('https://api.new.com');
        expect(col.type).toBe('collection'); // unchanged
    });

    it('updateCollection with auth fields', () => {
        useWorkspaceStore.getState().updateCollection('col-1', {
            authType: 'bearer',
            authToken: 'abc123',
            forceCollectionAuth: true,
        });
        const col = useWorkspaceStore.getState().collections[0];
        expect(col.authType).toBe('bearer');
        expect(col.authToken).toBe('abc123');
        expect(col.forceCollectionAuth).toBe(true);
    });
});

// ─── Store: Request CRUD ────────────────────────────────────────────

describe('workspaceStore — request CRUD', () => {
    beforeEach(resetStore);

    it('addRequest creates a new request in the collection', () => {
        useWorkspaceStore.getState().addRequest('col-1');
        const { collections, activeTabs, activeTabId } = useWorkspaceStore.getState();
        const items = collections[0].items;
        expect(items).toHaveLength(1);
        expect(items[0].type).toBe('request');
        expect(items[0].name).toBe('New Request');
        expect(items[0].method).toBe('GET');
        expect(items[0].body).toEqual({ type: 'json', content: '' });
        expect(activeTabs).toHaveLength(1);
        expect(activeTabId).toBe(items[0].id);
    });

    it('updateRequest updates a request in items and tabs', () => {
        useWorkspaceStore.getState().addRequest('col-1');
        const reqId = useWorkspaceStore.getState().collections[0].items[0].id;

        useWorkspaceStore.getState().updateRequest(reqId, { name: 'Updated', method: 'POST', url: '/test' });

        const updated = useWorkspaceStore.getState().collections[0].items[0];
        expect(updated.name).toBe('Updated');
        expect(updated.method).toBe('POST');
        expect(updated.url).toBe('/test');

        const tab = useWorkspaceStore.getState().activeTabs.find(t => t.id === reqId);
        expect(tab.name).toBe('Updated');
    });

    it('deleteRequest removes from items, tabs, and responses', () => {
        useWorkspaceStore.getState().addRequest('col-1');
        const reqId = useWorkspaceStore.getState().collections[0].items[0].id;

        // Set up a response for the request
        useWorkspaceStore.getState().setResponseData(reqId, { status: 200 }, 100);
        expect(useWorkspaceStore.getState().responses[reqId]).toBeDefined();

        useWorkspaceStore.getState().deleteRequest(reqId);

        const { collections, activeTabs, activeTabId, responses } = useWorkspaceStore.getState();
        expect(collections[0].items).toHaveLength(0);
        expect(activeTabs).toHaveLength(0);
        expect(activeTabId).toBeNull();
        expect(responses[reqId]).toBeUndefined();
    });

    it('deleteRequest nulls out test suite references', () => {
        // Add a request and a test suite referencing it
        useWorkspaceStore.getState().addRequest('col-1');
        const reqId = useWorkspaceStore.getState().collections[0].items[0].id;

        useWorkspaceStore.setState(state => ({
            collections: state.collections.map(col => ({
                ...col,
                testSuites: [{
                    id: 'suite-1',
                    tests: [{ id: 't1', requestId: reqId, name: 'Test 1' }]
                }]
            }))
        }));

        useWorkspaceStore.getState().deleteRequest(reqId);

        const suite = useWorkspaceStore.getState().collections[0].testSuites[0];
        expect(suite.tests[0].requestId).toBeNull();
    });

    it('duplicateRequest creates a copy next to original', () => {
        useWorkspaceStore.getState().addRequest('col-1');
        const reqId = useWorkspaceStore.getState().collections[0].items[0].id;
        useWorkspaceStore.getState().updateRequest(reqId, { name: 'Original', url: '/api/test' });

        useWorkspaceStore.getState().duplicateRequest(reqId);

        const items = useWorkspaceStore.getState().collections[0].items;
        expect(items).toHaveLength(2);
        expect(items[0].name).toBe('Original');
        expect(items[1].name).toBe('Original (copy)');
        expect(items[1].url).toBe('/api/test');
        expect(items[1].id).not.toBe(reqId);
    });

    it('renameItem renames a request in items and tabs', () => {
        useWorkspaceStore.getState().addRequest('col-1');
        const reqId = useWorkspaceStore.getState().collections[0].items[0].id;

        useWorkspaceStore.getState().renameItem(reqId, 'My Endpoint');

        expect(useWorkspaceStore.getState().collections[0].items[0].name).toBe('My Endpoint');
        expect(useWorkspaceStore.getState().activeTabs[0].name).toBe('My Endpoint');
    });

    it('renameItem renames a collection', () => {
        useWorkspaceStore.getState().renameItem('col-1', 'Renamed Collection');
        // renameRecursive traverses collections array too (they have id and name)
        expect(useWorkspaceStore.getState().collections[0].name).toBe('Renamed Collection');
    });
});

// ─── Store: Folder Operations ───────────────────────────────────────

describe('workspaceStore — folder operations', () => {
    beforeEach(resetStore);

    it('addFolder creates an empty folder in the collection', () => {
        const folderId = useWorkspaceStore.getState().addFolder('col-1', 'Auth');
        const items = useWorkspaceStore.getState().collections[0].items;
        expect(items).toHaveLength(1);
        expect(items[0].type).toBe('folder');
        expect(items[0].name).toBe('Auth');
        expect(items[0].items).toEqual([]);
        expect(folderId).toBe(items[0].id);
    });

    it('addRequestToFolder adds a request inside a folder', () => {
        const folderId = useWorkspaceStore.getState().addFolder('col-1', 'Auth');
        useWorkspaceStore.getState().addRequestToFolder('col-1', folderId);

        const folder = useWorkspaceStore.getState().collections[0].items[0];
        expect(folder.items).toHaveLength(1);
        expect(folder.items[0].type).toBe('request');
        expect(folder.items[0].name).toBe('New Request');
    });

    it('moveItemToFolder moves a root item into a folder', () => {
        // Add a request and a folder
        useWorkspaceStore.getState().addRequest('col-1');
        const reqId = useWorkspaceStore.getState().collections[0].items[0].id;
        const folderId = useWorkspaceStore.getState().addFolder('col-1', 'Moved');

        useWorkspaceStore.getState().moveItemToFolder(reqId, folderId, 'col-1');

        const items = useWorkspaceStore.getState().collections[0].items;
        // Root should only have the folder now
        expect(items).toHaveLength(1);
        expect(items[0].type).toBe('folder');
        expect(items[0].items).toHaveLength(1);
        expect(items[0].items[0].id).toBe(reqId);
    });

    it('moveItemToFolder moves an item to root (null target)', () => {
        const folderId = useWorkspaceStore.getState().addFolder('col-1', 'Source');
        useWorkspaceStore.getState().addRequestToFolder('col-1', folderId);
        const reqId = useWorkspaceStore.getState().collections[0].items[0].items[0].id;

        useWorkspaceStore.getState().moveItemToFolder(reqId, null, 'col-1');

        const items = useWorkspaceStore.getState().collections[0].items;
        // Folder should be empty, request at root
        expect(items).toHaveLength(2);
        expect(items[0].type).toBe('folder');
        expect(items[0].items).toHaveLength(0);
        expect(items[1].id).toBe(reqId);
    });

    it('updateRequest works inside nested folders', () => {
        const folderId = useWorkspaceStore.getState().addFolder('col-1', 'Deep');
        useWorkspaceStore.getState().addRequestToFolder('col-1', folderId);
        const reqId = useWorkspaceStore.getState().collections[0].items[0].items[0].id;

        useWorkspaceStore.getState().updateRequest(reqId, { url: '/deep/path' });

        const req = useWorkspaceStore.getState().collections[0].items[0].items[0];
        expect(req.url).toBe('/deep/path');
    });

    it('deleteRequest removes from inside folders', () => {
        const folderId = useWorkspaceStore.getState().addFolder('col-1', 'Folder');
        useWorkspaceStore.getState().addRequestToFolder('col-1', folderId);
        const reqId = useWorkspaceStore.getState().collections[0].items[0].items[0].id;

        useWorkspaceStore.getState().deleteRequest(reqId);

        const folder = useWorkspaceStore.getState().collections[0].items[0];
        expect(folder.items).toHaveLength(0);
    });

    it('findCollectionForRequest finds requests inside folders', () => {
        const folderId = useWorkspaceStore.getState().addFolder('col-1', 'Inner');
        useWorkspaceStore.getState().addRequestToFolder('col-1', folderId);
        const reqId = useWorkspaceStore.getState().collections[0].items[0].items[0].id;

        expect(useWorkspaceStore.getState().findCollectionForRequest(reqId)).toBe('col-1');
    });

    it('findCollectionForRequest returns null for unknown id', () => {
        expect(useWorkspaceStore.getState().findCollectionForRequest('nonexistent')).toBeNull();
    });
});

// ─── Store: Tab Management ──────────────────────────────────────────

describe('workspaceStore — tab management', () => {
    beforeEach(resetStore);

    it('openTab adds a new tab and sets it active', () => {
        useWorkspaceStore.getState().openTab({ id: 'r1', name: 'Test', type: 'request' });
        const { activeTabs, activeTabId } = useWorkspaceStore.getState();
        expect(activeTabs).toHaveLength(1);
        expect(activeTabId).toBe('r1');
    });

    it('openTab does not duplicate existing tab', () => {
        useWorkspaceStore.getState().openTab({ id: 'r1', name: 'Test', type: 'request' });
        useWorkspaceStore.getState().openTab({ id: 'r1', name: 'Test', type: 'request' });
        expect(useWorkspaceStore.getState().activeTabs).toHaveLength(1);
    });

    it('closeTab removes tab and updates active', () => {
        useWorkspaceStore.getState().openTab({ id: 'r1', name: 'A', type: 'request' });
        useWorkspaceStore.getState().openTab({ id: 'r2', name: 'B', type: 'request' });
        // Active is r2 (last opened)
        useWorkspaceStore.getState().closeTab('r2');

        const { activeTabs, activeTabId } = useWorkspaceStore.getState();
        expect(activeTabs).toHaveLength(1);
        expect(activeTabId).toBe('r1');
    });

    it('closeTab clears response cache for closed tab', () => {
        useWorkspaceStore.getState().openTab({ id: 'r1', name: 'A', type: 'request' });
        useWorkspaceStore.getState().setResponseData('r1', { data: 'test' }, 50);
        expect(useWorkspaceStore.getState().responses['r1']).toBeDefined();

        useWorkspaceStore.getState().closeTab('r1');
        expect(useWorkspaceStore.getState().responses['r1']).toBeUndefined();
    });

    it('closeTab sets activeTabId to null when all tabs closed', () => {
        useWorkspaceStore.getState().openTab({ id: 'r1', name: 'A', type: 'request' });
        useWorkspaceStore.getState().closeTab('r1');
        expect(useWorkspaceStore.getState().activeTabId).toBeNull();
    });

    it('setActiveTab switches active tab', () => {
        useWorkspaceStore.getState().openTab({ id: 'r1', name: 'A', type: 'request' });
        useWorkspaceStore.getState().openTab({ id: 'r2', name: 'B', type: 'request' });
        useWorkspaceStore.getState().setActiveTab('r1');
        expect(useWorkspaceStore.getState().activeTabId).toBe('r1');
    });
});

// ─── Store: resolveVariables ────────────────────────────────────────

describe('workspaceStore — resolveVariables', () => {
    beforeEach(resetStore);

    it('returns non-string input as-is', () => {
        expect(useWorkspaceStore.getState().resolveVariables(null)).toBeNull();
        expect(useWorkspaceStore.getState().resolveVariables(undefined)).toBeUndefined();
        expect(useWorkspaceStore.getState().resolveVariables(42)).toBe(42);
    });

    it('returns string without variables unchanged', () => {
        expect(useWorkspaceStore.getState().resolveVariables('hello world')).toBe('hello world');
    });

    it('resolves Global environment variables', () => {
        const result = useWorkspaceStore.getState().resolveVariables('{{baseUrl}}/users');
        expect(result).toBe('https://api.example.com/users');
    });

    it('resolves active env variables, overriding Global', () => {
        useWorkspaceStore.setState({
            environments: [
                { name: 'Global', vars: [{ key: 'host', value: 'global.com', enabled: true }] },
                { name: 'Dev', vars: [{ key: 'host', value: 'dev.com', enabled: true }] },
            ],
            activeEnv: 'Dev',
        });
        expect(useWorkspaceStore.getState().resolveVariables('https://{{host}}')).toBe('https://dev.com');
    });

    it('falls through to Global when active env does not have the var', () => {
        useWorkspaceStore.setState({
            environments: [
                { name: 'Global', vars: [{ key: 'apiKey', value: 'abc123', enabled: true }] },
                { name: 'Staging', vars: [{ key: 'host', value: 'staging.com', enabled: true }] },
            ],
            activeEnv: 'Staging',
        });
        expect(useWorkspaceStore.getState().resolveVariables('key={{apiKey}}')).toBe('key=abc123');
    });

    it('chain vars override environment vars', () => {
        useWorkspaceStore.setState({
            chainVars: { baseUrl: 'https://chain-override.com' },
        });
        expect(useWorkspaceStore.getState().resolveVariables('{{baseUrl}}')).toBe('https://chain-override.com');
    });

    it('resolves dynamic $timestamp variable', () => {
        const result = useWorkspaceStore.getState().resolveVariables('ts={{$timestamp}}');
        expect(result).toMatch(/^ts=\d+$/);
    });

    it('resolves dynamic $guid variable', () => {
        const result = useWorkspaceStore.getState().resolveVariables('id={{$guid}}');
        expect(result).not.toBe('id={{$guid}}');
        expect(result.length).toBeGreaterThan(5);
    });

    it('resolves dynamic $randomEmail variable', () => {
        const result = useWorkspaceStore.getState().resolveVariables('{{$randomEmail}}');
        expect(result).toContain('@test.com');
    });

    it('resolves dynamic $randomInt variable', () => {
        const result = useWorkspaceStore.getState().resolveVariables('n={{$randomInt}}');
        const num = parseInt(result.replace('n=', ''));
        expect(num).toBeGreaterThanOrEqual(0);
        expect(num).toBeLessThan(1000);
    });

    it('resolves dynamic $isoTimestamp variable', () => {
        const result = useWorkspaceStore.getState().resolveVariables('{{$isoTimestamp}}');
        expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('resolves dynamic $randomName variable', () => {
        const result = useWorkspaceStore.getState().resolveVariables('{{$randomName}}');
        expect(result).not.toBe('{{$randomName}}');
        expect(result.length).toBeGreaterThan(0);
    });

    it('resolves dynamic $randomBoolean variable', () => {
        const result = useWorkspaceStore.getState().resolveVariables('{{$randomBoolean}}');
        expect(['true', 'false']).toContain(result);
    });

    it('resolves dynamic $randomPhone variable', () => {
        const result = useWorkspaceStore.getState().resolveVariables('{{$randomPhone}}');
        expect(result).toMatch(/^\d{10}$/);
    });

    it('keeps unresolved variables as-is', () => {
        expect(useWorkspaceStore.getState().resolveVariables('{{unknown}}')).toBe('{{unknown}}');
    });

    it('skips disabled env vars', () => {
        useWorkspaceStore.setState({
            environments: [
                { name: 'Global', vars: [{ key: 'off', value: 'nope', enabled: false }] },
            ],
            activeEnv: 'Global',
        });
        expect(useWorkspaceStore.getState().resolveVariables('{{off}}')).toBe('{{off}}');
    });

    it('resolves multiple variables in one string', () => {
        useWorkspaceStore.setState({
            environments: [
                { name: 'Global', vars: [
                    { key: 'host', value: 'api.com', enabled: true },
                    { key: 'version', value: 'v2', enabled: true },
                ] },
            ],
        });
        expect(useWorkspaceStore.getState().resolveVariables('https://{{host}}/{{version}}/users'))
            .toBe('https://api.com/v2/users');
    });
});

// ─── Store: getCollectionRole / canEditCollection ───────────────────

describe('workspaceStore — collection roles', () => {
    beforeEach(resetStore);

    it('getCollectionRole returns null when no user', () => {
        expect(useWorkspaceStore.getState().getCollectionRole('col-1')).toBeNull();
    });

    it('getCollectionRole returns owner when user is owner', () => {
        useWorkspaceStore.setState({
            user: { id: 'user-1', email: 'test@test.com' },
            collections: [{
                id: 'col-1', name: 'Mine', type: 'collection', items: [],
                owner_id: 'user-1',
            }],
        });
        expect(useWorkspaceStore.getState().getCollectionRole('col-1')).toBe('owner');
    });

    it('getCollectionRole returns owner when no owner_id set', () => {
        useWorkspaceStore.setState({
            user: { id: 'user-1' },
            collections: [{ id: 'col-1', name: 'Local', type: 'collection', items: [] }],
        });
        expect(useWorkspaceStore.getState().getCollectionRole('col-1')).toBe('owner');
    });

    it('getCollectionRole returns _shareRole for shared collection', () => {
        useWorkspaceStore.setState({
            user: { id: 'user-1' },
            collections: [{
                id: 'col-2', name: 'Shared', type: 'collection', items: [],
                owner_id: 'other-user', _shareRole: 'editor',
            }],
        });
        expect(useWorkspaceStore.getState().getCollectionRole('col-2')).toBe('editor');
    });

    it('getCollectionRole defaults to viewer for shared without explicit role', () => {
        useWorkspaceStore.setState({
            user: { id: 'user-1' },
            collections: [{
                id: 'col-3', name: 'Shared No Role', type: 'collection', items: [],
                owner_id: 'other-user',
            }],
        });
        expect(useWorkspaceStore.getState().getCollectionRole('col-3')).toBe('viewer');
    });

    it('getCollectionRole returns null for non-existent collection', () => {
        useWorkspaceStore.setState({ user: { id: 'user-1' } });
        expect(useWorkspaceStore.getState().getCollectionRole('nonexistent')).toBeNull();
    });

    it('canEditCollection returns true for owner', () => {
        useWorkspaceStore.setState({
            user: { id: 'user-1' },
            collections: [{ id: 'col-1', name: 'Mine', items: [], owner_id: 'user-1' }],
        });
        expect(useWorkspaceStore.getState().canEditCollection('col-1')).toBe(true);
    });

    it('canEditCollection returns true for editor', () => {
        useWorkspaceStore.setState({
            user: { id: 'user-1' },
            collections: [{ id: 'col-1', items: [], owner_id: 'other', _shareRole: 'editor' }],
        });
        expect(useWorkspaceStore.getState().canEditCollection('col-1')).toBe(true);
    });

    it('canEditCollection returns false for viewer', () => {
        useWorkspaceStore.setState({
            user: { id: 'user-1' },
            collections: [{ id: 'col-1', items: [], owner_id: 'other', _shareRole: 'viewer' }],
        });
        expect(useWorkspaceStore.getState().canEditCollection('col-1')).toBe(false);
    });

    it('canEditCollection returns false when no user', () => {
        expect(useWorkspaceStore.getState().canEditCollection('col-1')).toBe(false);
    });
});

// ─── Store: Environment Management ──────────────────────────────────

describe('workspaceStore — environment management', () => {
    beforeEach(resetStore);

    it('has Global environment by default', () => {
        const { environments, activeEnv } = useWorkspaceStore.getState();
        expect(environments).toHaveLength(1);
        expect(environments[0].name).toBe('Global');
        expect(activeEnv).toBe('Global');
    });

    it('addEnvironment creates a new env and sets it active', () => {
        useWorkspaceStore.getState().addEnvironment('Staging');
        const { environments, activeEnv } = useWorkspaceStore.getState();
        expect(environments).toHaveLength(2);
        expect(environments[1].name).toBe('Staging');
        expect(environments[1].vars).toEqual([]);
        expect(activeEnv).toBe('Staging');
    });

    it('deleteEnvironment removes env and falls back to Global', () => {
        useWorkspaceStore.getState().addEnvironment('Temp');
        expect(useWorkspaceStore.getState().activeEnv).toBe('Temp');

        useWorkspaceStore.getState().deleteEnvironment('Temp');
        const { environments, activeEnv } = useWorkspaceStore.getState();
        expect(environments).toHaveLength(1);
        expect(activeEnv).toBe('Global');
    });

    it('deleteEnvironment does not delete Global', () => {
        useWorkspaceStore.getState().deleteEnvironment('Global');
        expect(useWorkspaceStore.getState().environments).toHaveLength(1);
        expect(useWorkspaceStore.getState().environments[0].name).toBe('Global');
    });

    it('deleteEnvironment keeps activeEnv if deleting non-active env', () => {
        useWorkspaceStore.getState().addEnvironment('Staging');
        useWorkspaceStore.getState().addEnvironment('Production');
        useWorkspaceStore.getState().setActiveEnv('Production');

        useWorkspaceStore.getState().deleteEnvironment('Staging');
        expect(useWorkspaceStore.getState().activeEnv).toBe('Production');
    });

    it('updateEnvVars updates variables for an environment', () => {
        const vars = [
            { key: 'host', value: 'localhost', enabled: true },
            { key: 'port', value: '3000', enabled: true },
        ];
        useWorkspaceStore.getState().updateEnvVars('Global', vars);
        expect(useWorkspaceStore.getState().environments[0].vars).toEqual(vars);
    });

    it('setActiveEnv switches the active environment', () => {
        useWorkspaceStore.getState().addEnvironment('Dev');
        useWorkspaceStore.getState().setActiveEnv('Global');
        expect(useWorkspaceStore.getState().activeEnv).toBe('Global');
    });
});

// ─── Store: Chain Variables ─────────────────────────────────────────

describe('workspaceStore — chain variables', () => {
    beforeEach(resetStore);

    it('setChainVar adds a chain variable', () => {
        useWorkspaceStore.getState().setChainVar('token', 'abc123');
        expect(useWorkspaceStore.getState().chainVars.token).toBe('abc123');
    });

    it('setChainVar overwrites existing value', () => {
        useWorkspaceStore.getState().setChainVar('token', 'old');
        useWorkspaceStore.getState().setChainVar('token', 'new');
        expect(useWorkspaceStore.getState().chainVars.token).toBe('new');
    });

    it('clearChainVars removes all chain vars', () => {
        useWorkspaceStore.getState().setChainVar('a', '1');
        useWorkspaceStore.getState().setChainVar('b', '2');
        useWorkspaceStore.getState().clearChainVars();
        expect(useWorkspaceStore.getState().chainVars).toEqual({});
    });
});

// ─── Store: Response Management ─────────────────────────────────────

describe('workspaceStore — response management', () => {
    beforeEach(resetStore);

    it('setResponseLoading sets loading state', () => {
        useWorkspaceStore.getState().setResponseLoading('r1', true);
        expect(useWorkspaceStore.getState().responses['r1'].loading).toBe(true);
    });

    it('setResponseData stores response and clears loading', () => {
        useWorkspaceStore.getState().setResponseData('r1', { status: 200 }, 150);
        const resp = useWorkspaceStore.getState().responses['r1'];
        expect(resp.data).toEqual({ status: 200 });
        expect(resp.time).toBe(150);
        expect(resp.loading).toBe(false);
    });
});

// ─── Store: Request History ─────────────────────────────────────────

describe('workspaceStore — request history', () => {
    beforeEach(resetStore);

    it('addRequestHistory adds an entry', () => {
        useWorkspaceStore.getState().addRequestHistory({ method: 'GET', url: '/test', status: 200 });
        const history = useWorkspaceStore.getState().requestHistory;
        expect(history).toHaveLength(1);
        expect(history[0].method).toBe('GET');
        expect(history[0].id).toBeDefined();
        expect(history[0].timestamp).toBeDefined();
    });

    it('addRequestHistory prepends (most recent first)', () => {
        useWorkspaceStore.getState().addRequestHistory({ url: '/first' });
        useWorkspaceStore.getState().addRequestHistory({ url: '/second' });
        expect(useWorkspaceStore.getState().requestHistory[0].url).toBe('/second');
    });

    it('addRequestHistory caps at 50 entries', () => {
        for (let i = 0; i < 55; i++) {
            useWorkspaceStore.getState().addRequestHistory({ url: `/req-${i}` });
        }
        expect(useWorkspaceStore.getState().requestHistory).toHaveLength(50);
    });

    it('clearRequestHistory empties the history', () => {
        useWorkspaceStore.getState().addRequestHistory({ url: '/test' });
        useWorkspaceStore.getState().clearRequestHistory();
        expect(useWorkspaceStore.getState().requestHistory).toEqual([]);
    });
});

// ─── Store: Collection Runner ───────────────────────────────────────

describe('workspaceStore — collection runner', () => {
    beforeEach(() => {
        resetStore();
        // Add some items to the collection
        useWorkspaceStore.setState(state => ({
            collections: state.collections.map(col => ({
                ...col,
                items: [
                    { id: 'r1', name: 'Req 1', type: 'request', method: 'GET', url: '/a' },
                    {
                        id: 'f1', name: 'Folder', type: 'folder', items: [
                            { id: 'r2', name: 'Req 2', type: 'request', method: 'POST', url: '/b' },
                        ]
                    },
                ]
            }))
        }));
    });

    it('openRunner initializes runner with all requests', () => {
        useWorkspaceStore.getState().openRunner('col-1');
        const runner = useWorkspaceStore.getState().runner;
        expect(runner).not.toBeNull();
        expect(runner.collectionId).toBe('col-1');
        expect(runner.requests).toHaveLength(2); // r1 and r2 (flattened from folder)
        expect(runner.running).toBe(false);
        expect(runner.results).toEqual([]);
    });

    it('openRunner returns empty for non-existent collection', () => {
        useWorkspaceStore.getState().openRunner('nonexistent');
        expect(useWorkspaceStore.getState().runner).toBeNull();
    });

    it('openRunnerForFolder runs only folder requests', () => {
        useWorkspaceStore.getState().openRunnerForFolder('col-1', 'f1');
        const runner = useWorkspaceStore.getState().runner;
        expect(runner.requests).toHaveLength(1);
        expect(runner.requests[0].id).toBe('r2');
        expect(runner.collectionName).toContain('Folder');
    });

    it('closeRunner sets runner to null', () => {
        useWorkspaceStore.getState().openRunner('col-1');
        useWorkspaceStore.getState().closeRunner();
        expect(useWorkspaceStore.getState().runner).toBeNull();
    });

    it('setRunnerState updates runner fields', () => {
        useWorkspaceStore.getState().openRunner('col-1');
        useWorkspaceStore.getState().setRunnerState({ running: true, progress: 1 });
        const runner = useWorkspaceStore.getState().runner;
        expect(runner.running).toBe(true);
        expect(runner.progress).toBe(1);
    });

    it('setRunnerState is no-op when runner is null', () => {
        useWorkspaceStore.getState().setRunnerState({ running: true });
        expect(useWorkspaceStore.getState().runner).toBeNull();
    });
});

// ─── Store: UI Toggles ──────────────────────────────────────────────

describe('workspaceStore — UI toggles', () => {
    beforeEach(resetStore);

    it('setCurrentView changes the view', () => {
        useWorkspaceStore.getState().setCurrentView('workspace');
        expect(useWorkspaceStore.getState().currentView).toBe('workspace');
    });

    it('toggleLocalMode flips the flag', () => {
        expect(useWorkspaceStore.getState().localMode).toBe(false);
        useWorkspaceStore.getState().toggleLocalMode();
        expect(useWorkspaceStore.getState().localMode).toBe(true);
        useWorkspaceStore.getState().toggleLocalMode();
        expect(useWorkspaceStore.getState().localMode).toBe(false);
    });

    it('toggleSidebar flips sidebarCollapsed', () => {
        expect(useWorkspaceStore.getState().sidebarCollapsed).toBe(false);
        useWorkspaceStore.getState().toggleSidebar();
        expect(useWorkspaceStore.getState().sidebarCollapsed).toBe(true);
    });

    it('setSidebarWidth clamps between 200 and 400', () => {
        useWorkspaceStore.getState().setSidebarWidth(100);
        expect(useWorkspaceStore.getState().sidebarWidth).toBe(200);
        useWorkspaceStore.getState().setSidebarWidth(500);
        expect(useWorkspaceStore.getState().sidebarWidth).toBe(400);
        useWorkspaceStore.getState().setSidebarWidth(300);
        expect(useWorkspaceStore.getState().sidebarWidth).toBe(300);
    });

    it('setEditorSplitRatio clamps between 0.25 and 0.75', () => {
        useWorkspaceStore.getState().setEditorSplitRatio(0.1);
        expect(useWorkspaceStore.getState().editorSplitRatio).toBe(0.25);
        useWorkspaceStore.getState().setEditorSplitRatio(0.9);
        expect(useWorkspaceStore.getState().editorSplitRatio).toBe(0.75);
        useWorkspaceStore.getState().setEditorSplitRatio(0.6);
        expect(useWorkspaceStore.getState().editorSplitRatio).toBe(0.6);
    });
});

// ─── Store: WebSocket ───────────────────────────────────────────────

describe('workspaceStore — addWebSocket', () => {
    beforeEach(resetStore);

    it('creates a websocket item in the collection', () => {
        useWorkspaceStore.getState().addWebSocket('col-1');
        const items = useWorkspaceStore.getState().collections[0].items;
        expect(items).toHaveLength(1);
        expect(items[0].type).toBe('websocket');
        expect(items[0].method).toBe('WS');
        expect(items[0].url).toBe('wss://');
    });

    it('opens a tab for the new websocket', () => {
        useWorkspaceStore.getState().addWebSocket('col-1');
        const { activeTabs, activeTabId } = useWorkspaceStore.getState();
        expect(activeTabs).toHaveLength(1);
        expect(activeTabs[0].type).toBe('websocket');
        expect(activeTabId).toBe(activeTabs[0].id);
    });
});

// ─── Store: Pending Suggestions ─────────────────────────────────────

describe('workspaceStore — AI suggestions', () => {
    beforeEach(resetStore);

    it('setPendingSuggestions stores suggestions for a request', () => {
        useWorkspaceStore.getState().setPendingSuggestions('r1', [{ name: 'Test status 200' }]);
        const pending = useWorkspaceStore.getState().pendingSuggestions['r1'];
        expect(pending.suggestions).toHaveLength(1);
        expect(pending.status).toBe('ready');
        expect(pending.generatedAt).toBeDefined();
    });

    it('clearPendingSuggestions removes suggestions for a request', () => {
        useWorkspaceStore.getState().setPendingSuggestions('r1', [{ name: 'A' }]);
        useWorkspaceStore.getState().setPendingSuggestions('r2', [{ name: 'B' }]);
        useWorkspaceStore.getState().clearPendingSuggestions('r1');
        expect(useWorkspaceStore.getState().pendingSuggestions['r1']).toBeUndefined();
        expect(useWorkspaceStore.getState().pendingSuggestions['r2']).toBeDefined();
    });
});

// ─── Store: Tour & Tutorial ─────────────────────────────────────────

describe('workspaceStore — tours and tutorials', () => {
    beforeEach(resetStore);

    it('startTour sets tour name and step 0', () => {
        useWorkspaceStore.getState().startTour('welcome');
        const state = useWorkspaceStore.getState();
        expect(state.activeTour).toBe('welcome');
        expect(state.tourStep).toBe(0);
        expect(state.currentView).toBe('dashboard');
    });

    it('startTour switches to mock-server view for mock-server tour', () => {
        useWorkspaceStore.getState().startTour('mock-server');
        expect(useWorkspaceStore.getState().currentView).toBe('mock-server');
    });

    it('stopTour resets tour state and marks welcome seen', () => {
        useWorkspaceStore.getState().startTour('welcome');
        useWorkspaceStore.getState().stopTour();
        const state = useWorkspaceStore.getState();
        expect(state.activeTour).toBeNull();
        expect(state.tourStep).toBe(0);
        expect(state.hasSeenWelcomeTour).toBe(true);
    });

    it('setTourStep updates the step', () => {
        useWorkspaceStore.getState().startTour('welcome');
        useWorkspaceStore.getState().setTourStep(3);
        expect(useWorkspaceStore.getState().tourStep).toBe(3);
    });

    it('startTutorial / stopTutorial manage tutorial state', () => {
        useWorkspaceStore.getState().startTutorial('first-request');
        expect(useWorkspaceStore.getState().activeTutorial).toBe('first-request');
        useWorkspaceStore.getState().stopTutorial();
        expect(useWorkspaceStore.getState().activeTutorial).toBeNull();
    });
});
