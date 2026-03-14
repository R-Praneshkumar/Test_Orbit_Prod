/**
 * Export TestOrbit collections as Postman Collection v2.1 or OpenAPI 3.x.
 */

import { downloadFile } from './exportResults';

// ──────────────────────────────────────────────
// Postman Collection v2.1 Export
// ──────────────────────────────────────────────

function buildPostmanAuth(col) {
    if (!col.authType || col.authType === 'none') return undefined;
    if (col.authType === 'bearer') {
        return { type: 'bearer', bearer: [{ key: 'token', value: col.authToken || '', type: 'string' }] };
    }
    if (col.authType === 'basic') {
        return {
            type: 'basic',
            basic: [
                { key: 'username', value: col.authUsername || '', type: 'string' },
                { key: 'password', value: col.authPassword || '', type: 'string' },
            ],
        };
    }
    if (col.authType === 'apikey') {
        return {
            type: 'apikey',
            apikey: [
                { key: 'key', value: col.authKeyName || 'X-API-Key', type: 'string' },
                { key: 'value', value: col.authKeyValue || '', type: 'string' },
                { key: 'in', value: 'header', type: 'string' },
            ],
        };
    }
    return undefined;
}

function buildPostmanUrl(url, params) {
    const raw = url || '';
    const result = { raw };
    try {
        const parsed = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
        result.protocol = parsed.protocol.replace(':', '');
        result.host = parsed.hostname.split('.');
        result.port = parsed.port || undefined;
        result.path = parsed.pathname.split('/').filter(Boolean);
        // Merge query params from URL + explicit params
        const qp = [];
        parsed.searchParams.forEach((v, k) => qp.push({ key: k, value: v }));
        if (params?.length) {
            for (const p of params) {
                if (p.enabled !== false && p.key) {
                    // Skip if already in URL
                    if (!qp.some(q => q.key === p.key)) {
                        qp.push({ key: p.key, value: p.value || '' });
                    }
                }
            }
        }
        if (qp.length) result.query = qp;
    } catch {
        // URL parsing failed — keep raw only
    }
    return result;
}

function buildPostmanBody(body) {
    if (!body?.content) return undefined;
    const type = body.type || 'json';
    if (type === 'json') {
        return { mode: 'raw', raw: body.content, options: { raw: { language: 'json' } } };
    }
    if (type === 'raw') {
        return { mode: 'raw', raw: body.content, options: { raw: { language: 'text' } } };
    }
    if (type === 'urlencoded' || type === 'form') {
        let pairs = [];
        try { pairs = JSON.parse(body.content); } catch { /* ignore */ }
        const mode = type === 'form' ? 'formdata' : 'urlencoded';
        return {
            mode,
            [mode]: Array.isArray(pairs) ? pairs.map(p => ({
                key: p.key || '', value: p.value || '',
                disabled: p.enabled === false,
                type: 'text',
            })) : [],
        };
    }
    return undefined;
}

function buildPostmanEvents(preScript, postScript) {
    const events = [];
    if (preScript?.trim()) {
        events.push({ listen: 'prerequest', script: { exec: preScript.split('\n'), type: 'text/javascript' } });
    }
    if (postScript?.trim()) {
        events.push({ listen: 'test', script: { exec: postScript.split('\n'), type: 'text/javascript' } });
    }
    return events.length > 0 ? events : undefined;
}

/**
 * Recursively convert TestOrbit items to Postman v2.1 items — preserves folder hierarchy.
 */
function convertItems(items) {
    return (items || []).filter(Boolean).map(item => {
        if (item.type === 'folder') {
            return {
                name: item.name,
                item: convertItems(item.items || []),
            };
        }
        // Request or WebSocket
        const req = {
            name: item.name || 'Untitled',
            request: {
                method: item.method || 'GET',
                header: (item.headers || []).filter(h => h.enabled !== false && h.key).map(h => ({
                    key: h.key, value: h.value || '', type: 'text',
                })),
                url: buildPostmanUrl(item.url, item.params),
                body: buildPostmanBody(item.body),
                description: item.description || undefined,
            },
            event: buildPostmanEvents(item.preScript, item.postScript),
        };
        return req;
    });
}

/**
 * Export a TestOrbit collection as Postman Collection v2.1 JSON.
 */
export function exportAsPostman(collection) {
    const postmanCol = {
        info: {
            name: collection.name,
            schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
        },
        item: convertItems(collection.items),
        auth: buildPostmanAuth(collection),
        event: buildPostmanEvents(collection.preScript, collection.postScript),
    };

    const json = JSON.stringify(postmanCol, null, 2);
    const safeName = collection.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadFile(json, `${safeName}_postman.json`, 'application/json');
}

// ──────────────────────────────────────────────
// OpenAPI 3.x Export
// ──────────────────────────────────────────────

/**
 * Try to parse a JSON body string into an OpenAPI schema-like object.
 */
function jsonToSchemaExample(bodyContent) {
    try {
        const obj = JSON.parse(bodyContent);
        return { example: obj };
    } catch {
        return null;
    }
}

/**
 * Build a path template from a URL, extracting path parameters.
 * e.g. "https://api.com/users/123" → { path: "/users/{id}", params: ["id"] }
 */
function urlToPathTemplate(url, baseUrl) {
    try {
        const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
        let path = parsed.pathname;
        // Strip base URL path prefix if present
        if (baseUrl) {
            try {
                const baseParsed = new URL(baseUrl.startsWith('http') ? baseUrl : `https://${baseUrl}`);
                if (path.startsWith(baseParsed.pathname) && baseParsed.pathname !== '/') {
                    path = path.slice(baseParsed.pathname.length);
                }
            } catch { /* ignore */ }
        }
        if (!path.startsWith('/')) path = '/' + path;

        // Replace numeric IDs and UUIDs with path params
        const params = [];
        const segments = path.split('/');
        const templated = segments.map(seg => {
            if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg)) {
                const name = `${segments[segments.indexOf(seg) - 1] || 'item'}Id`;
                params.push(name);
                return `{${name}}`;
            }
            if (/^\d+$/.test(seg) && seg.length < 10) {
                const name = `${segments[segments.indexOf(seg) - 1] || 'item'}Id`;
                params.push(name);
                return `{${name}}`;
            }
            // Replace {{variable}} with {variable}
            if (/^\{\{.+\}\}$/.test(seg)) {
                const varName = seg.slice(2, -2);
                params.push(varName);
                return `{${varName}}`;
            }
            return seg;
        });
        return { path: templated.join('/') || '/', params };
    } catch {
        return { path: url || '/', params: [] };
    }
}

/**
 * Extract server URL from a collection's baseUrl or first request URL.
 */
function extractServerUrl(collection) {
    if (collection.baseUrl) return collection.baseUrl;
    // Find first request with a URL
    const findFirst = (items) => {
        for (const item of (items || [])) {
            if (item.type === 'request' && item.url) return item.url;
            if (item.items) {
                const found = findFirst(item.items);
                if (found) return found;
            }
        }
        return null;
    };
    const firstUrl = findFirst(collection.items);
    if (firstUrl) {
        try {
            const parsed = new URL(firstUrl.startsWith('http') ? firstUrl : `https://${firstUrl}`);
            return `${parsed.protocol}//${parsed.host}`;
        } catch { /* ignore */ }
    }
    return 'https://api.example.com';
}

/**
 * Flatten all requests from nested items structure.
 */
function flattenRequests(items, folderPath = []) {
    const result = [];
    for (const item of (items || []).filter(Boolean)) {
        if (item.type === 'folder') {
            result.push(...flattenRequests(item.items || [], [...folderPath, item.name]));
        } else if (item.type === 'request' || item.type === 'websocket') {
            result.push({ ...item, _folderPath: folderPath });
        }
    }
    return result;
}

/**
 * Export a TestOrbit collection as OpenAPI 3.0.3 spec.
 */
export function exportAsOpenAPI(collection) {
    const serverUrl = extractServerUrl(collection);
    const requests = flattenRequests(collection.items);

    // Group requests by path template
    const paths = {};
    for (const req of requests) {
        if (req.type === 'websocket') continue; // Skip WebSocket items
        const { path, params: pathParams } = urlToPathTemplate(req.url || '', collection.baseUrl);
        const method = (req.method || 'GET').toLowerCase();

        if (!paths[path]) paths[path] = {};
        if (paths[path][method]) continue; // Skip duplicate method on same path

        const operation = {
            summary: req.name || undefined,
            operationId: (req.name || `${method}${path}`).replace(/[^a-zA-Z0-9]/g, '_'),
        };

        // Tags from folder path
        if (req._folderPath?.length > 0) {
            operation.tags = [req._folderPath[0]];
        }

        // Path parameters
        const parameters = [];
        for (const p of pathParams) {
            parameters.push({
                name: p,
                in: 'path',
                required: true,
                schema: { type: 'string' },
            });
        }

        // Query parameters
        for (const p of (req.params || [])) {
            if (p.enabled !== false && p.key) {
                parameters.push({
                    name: p.key,
                    in: 'query',
                    schema: { type: 'string' },
                    example: p.value || undefined,
                });
            }
        }

        // Header parameters (skip common ones)
        const skipHeaders = new Set(['content-type', 'authorization', 'accept', 'user-agent']);
        for (const h of (req.headers || [])) {
            if (h.enabled !== false && h.key && !skipHeaders.has(h.key.toLowerCase())) {
                parameters.push({
                    name: h.key,
                    in: 'header',
                    schema: { type: 'string' },
                    example: h.value || undefined,
                });
            }
        }

        if (parameters.length > 0) operation.parameters = parameters;

        // Request body
        if (['post', 'put', 'patch'].includes(method) && req.body?.content) {
            const bodyType = req.body.type || 'json';
            let contentType = 'application/json';
            let schemaInfo = {};

            if (bodyType === 'json') {
                const parsed = jsonToSchemaExample(req.body.content);
                schemaInfo = parsed || { example: req.body.content };
                schemaInfo.schema = { type: 'object' };
            } else if (bodyType === 'urlencoded') {
                contentType = 'application/x-www-form-urlencoded';
                schemaInfo = { schema: { type: 'object' } };
            } else if (bodyType === 'form') {
                contentType = 'multipart/form-data';
                schemaInfo = { schema: { type: 'object' } };
            } else {
                contentType = 'text/plain';
                schemaInfo = { schema: { type: 'string' }, example: req.body.content };
            }

            operation.requestBody = {
                content: { [contentType]: schemaInfo },
            };
        }

        // Responses (generic since we don't have schema info from test runs)
        operation.responses = {
            '200': { description: 'Successful response' },
        };

        paths[path][method] = operation;
    }

    // Build security schemes from collection auth
    const securitySchemes = {};
    const security = [];
    if (collection.authType === 'bearer') {
        securitySchemes.bearerAuth = { type: 'http', scheme: 'bearer' };
        security.push({ bearerAuth: [] });
    } else if (collection.authType === 'basic') {
        securitySchemes.basicAuth = { type: 'http', scheme: 'basic' };
        security.push({ basicAuth: [] });
    } else if (collection.authType === 'apikey') {
        securitySchemes.apiKeyAuth = {
            type: 'apiKey',
            in: 'header',
            name: collection.authKeyName || 'X-API-Key',
        };
        security.push({ apiKeyAuth: [] });
    }

    const spec = {
        openapi: '3.0.3',
        info: {
            title: collection.name,
            version: '1.0.0',
            description: `Exported from TestOrbit collection "${collection.name}"`,
        },
        servers: [{ url: serverUrl }],
        paths,
    };

    if (security.length > 0) {
        spec.security = security;
        spec.components = { securitySchemes };
    }

    const json = JSON.stringify(spec, null, 2);
    const safeName = collection.name.replace(/[^a-zA-Z0-9_-]/g, '_');
    downloadFile(json, `${safeName}_openapi.json`, 'application/json');
}
