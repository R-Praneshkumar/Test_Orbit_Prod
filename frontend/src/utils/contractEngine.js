/**
 * Client-side OpenAPI schema comparison engine.
 * Compares actual API response data against OpenAPI response schemas
 * to detect contract drift (missing fields, type mismatches, etc.)
 */

// Resolve $ref within a spec
function resolveRef(ref, specRoot) {
    if (!ref || !specRoot) return null;
    const parts = ref.replace('#/', '').split('/');
    let resolved = specRoot;
    for (const p of parts) {
        resolved = resolved?.[p];
        if (!resolved) return null;
    }
    return resolved;
}

// Map JSON typeof → OpenAPI type
function jsonTypeOf(val) {
    if (val === null || val === undefined) return 'null';
    if (Array.isArray(val)) return 'array';
    return typeof val; // 'string', 'number', 'boolean', 'object'
}

// Check if a value matches an OpenAPI type
function matchesType(val, specType) {
    const actual = jsonTypeOf(val);
    if (specType === 'integer') return actual === 'number' && Number.isInteger(val);
    if (specType === 'number') return actual === 'number';
    return actual === specType;
}

/**
 * Compare actual data against an OpenAPI schema node.
 * @param {any} data - The actual response data
 * @param {object} schema - The OpenAPI schema node
 * @param {object} specRoot - Full spec for $ref resolution
 * @param {string} path - Current path (for error reporting)
 * @returns {{ drifts: Array<{field, specType, actualType, issue, severity, message}>, passed: boolean }}
 */
export function compareToSchema(data, schema, specRoot = null, path = '') {
    const drifts = [];
    if (!schema) return { drifts, passed: true };

    // Resolve $ref
    let resolved = schema;
    if (schema.$ref) {
        resolved = resolveRef(schema.$ref, specRoot);
        if (!resolved) return { drifts, passed: true }; // Can't resolve, skip
    }

    // Handle allOf: merge all schemas
    if (resolved.allOf) {
        for (const sub of resolved.allOf) {
            const result = compareToSchema(data, sub, specRoot, path);
            drifts.push(...result.drifts);
        }
        return { drifts, passed: drifts.filter(d => d.severity === 'error').length === 0 };
    }

    // Handle oneOf/anyOf: at least one must match
    if (resolved.oneOf || resolved.anyOf) {
        const schemas = resolved.oneOf || resolved.anyOf;
        const best = { driftCount: Infinity, drifts: [] };
        for (const sub of schemas) {
            const result = compareToSchema(data, sub, specRoot, path);
            const errorCount = result.drifts.filter(d => d.severity === 'error').length;
            if (errorCount < best.driftCount) {
                best.driftCount = errorCount;
                best.drifts = result.drifts;
            }
            if (errorCount === 0) return { drifts: [], passed: true };
        }
        return { drifts: best.drifts, passed: best.driftCount === 0 };
    }

    const fieldPath = path || '(root)';

    // Type check
    if (resolved.type && data !== null && data !== undefined) {
        if (!matchesType(data, resolved.type)) {
            drifts.push({
                field: fieldPath,
                specType: resolved.type,
                actualType: jsonTypeOf(data),
                issue: 'type_mismatch',
                severity: 'error',
                message: `Expected ${resolved.type} but got ${jsonTypeOf(data)}`
            });
            return { drifts, passed: false }; // Type mismatch = stop deeper checks
        }
    }

    // Enum check
    if (resolved.enum && data !== null && data !== undefined) {
        if (!resolved.enum.includes(data)) {
            drifts.push({
                field: fieldPath,
                specType: `enum[${resolved.enum.join(', ')}]`,
                actualType: String(data),
                issue: 'invalid_enum',
                severity: 'error',
                message: `Value "${data}" is not in allowed enum: [${resolved.enum.join(', ')}]`
            });
        }
    }

    // Object: check required fields, property types, extra fields
    if (resolved.type === 'object' || resolved.properties) {
        if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
            const props = resolved.properties || {};
            const required = resolved.required || [];

            // Check required fields
            for (const req of required) {
                if (!(req in data)) {
                    drifts.push({
                        field: path ? `${path}.${req}` : req,
                        specType: props[req]?.type || 'any',
                        actualType: '(missing)',
                        issue: 'missing_required',
                        severity: 'error',
                        message: `Required field "${req}" is missing from response`
                    });
                }
            }

            // Check property types recursively
            for (const [key, propSchema] of Object.entries(props)) {
                if (key in data) {
                    const sub = compareToSchema(data[key], propSchema, specRoot, path ? `${path}.${key}` : key);
                    drifts.push(...sub.drifts);
                }
            }

            // Check for extra fields not in spec
            if (resolved.additionalProperties === false) {
                for (const key of Object.keys(data)) {
                    if (!(key in props)) {
                        drifts.push({
                            field: path ? `${path}.${key}` : key,
                            specType: '(not in spec)',
                            actualType: jsonTypeOf(data[key]),
                            issue: 'extra_field',
                            severity: 'warning',
                            message: `Field "${key}" exists in response but is not defined in spec`
                        });
                    }
                }
            }
        }
    }

    // Array: check items schema
    if (resolved.type === 'array' && resolved.items && Array.isArray(data)) {
        // Check first 3 items max to avoid performance issues
        const checkCount = Math.min(data.length, 3);
        for (let i = 0; i < checkCount; i++) {
            const sub = compareToSchema(data[i], resolved.items, specRoot, `${path}[${i}]`);
            drifts.push(...sub.drifts);
        }
    }

    return { drifts, passed: drifts.filter(d => d.severity === 'error').length === 0 };
}

/**
 * Extract the response schema for a specific endpoint from an OpenAPI spec.
 * @param {object} spec - Parsed OpenAPI spec
 * @param {string} method - HTTP method (lowercase)
 * @param {string} path - API path (e.g., /v1/users)
 * @param {string} statusCode - Expected status (default '200')
 * @returns {object|null} - The response schema, or null
 */
export function getResponseSchema(spec, method, path, statusCode = '200') {
    if (!spec?.paths?.[path]) return null;
    const op = spec.paths[path][method.toLowerCase()];
    if (!op?.responses) return null;

    // Try exact status, then 2xx, then default
    const resp = op.responses[statusCode] || op.responses['2xx'] || op.responses['default'];
    if (!resp) return null;

    return resp.content?.['application/json']?.schema || null;
}

/**
 * Run contract checks for all endpoints using cached responses.
 * @param {object} spec - Parsed OpenAPI spec
 * @param {object} cachedResponses - Map of requestId → { data, status }
 * @param {Array} requests - Flat array of request objects with url, method
 * @param {string} baseUrl - Base URL to strip for path matching
 * @returns {Array} - Results per endpoint
 */
export function runLocalContractChecks(spec, cachedResponses, requests, baseUrl = '') {
    if (!spec?.paths) return [];
    const results = [];

    for (const [path, pathItem] of Object.entries(spec.paths)) {
        for (const method of ['get', 'post', 'put', 'delete', 'patch']) {
            if (!pathItem[method]) continue;

            const schema = getResponseSchema(spec, method, path);
            if (!schema) continue;

            // Find matching request with cached response
            const fullUrl = `${baseUrl.replace(/\/+$/, '')}${path}`;
            const matchReq = requests.find(r =>
                (r.method || 'GET').toLowerCase() === method &&
                (r.url === fullUrl || r.url?.endsWith(path))
            );

            if (!matchReq || !cachedResponses[matchReq.id]?.data) {
                results.push({
                    method: method.toUpperCase(), path, fullUrl,
                    status: 'skipped', drifts: [], driftCount: 0,
                    message: 'No cached response available'
                });
                continue;
            }

            const responseData = cachedResponses[matchReq.id].data;
            let parsedData = responseData;
            if (typeof parsedData === 'string') {
                try { parsedData = JSON.parse(parsedData); } catch { /* keep string */ }
            }

            const { drifts, passed } = compareToSchema(parsedData, schema, spec);
            results.push({
                method: method.toUpperCase(), path, fullUrl,
                status: passed ? 'pass' : 'drift',
                actualStatus: cachedResponses[matchReq.id].status || 200,
                drifts, driftCount: drifts.length,
                responseTime: cachedResponses[matchReq.id].time || 0
            });
        }
    }
    return results;
}
