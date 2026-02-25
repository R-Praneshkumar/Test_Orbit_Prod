/**
 * Assertion Evaluation Engine
 *
 * Evaluates user-defined assertions against API responses.
 *
 * Assertion shape:
 * {
 *   id: string,
 *   type: 'status_code' | 'response_time' | 'body_contains' | 'body_not_contains' | 'json_path' | 'header_contains',
 *   target: string,       // json path, header name, etc.
 *   comparison: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'exists' | 'is_type',
 *   expected: string,     // expected value
 *   enabled: boolean,
 * }
 */

/**
 * Lightweight JSON Schema validator (supports type, required, properties, items, enum, minLength, maxLength, minimum, maximum).
 * Returns array of error strings (empty = valid).
 */
function validateJsonSchema(data, schema, path = '') {
    const errors = [];
    if (!schema) return errors;

    // Type check
    if (schema.type) {
        const t = schema.type;
        let valid = false;
        if (t === 'string') valid = typeof data === 'string';
        else if (t === 'number' || t === 'integer') valid = typeof data === 'number';
        else if (t === 'boolean') valid = typeof data === 'boolean';
        else if (t === 'array') valid = Array.isArray(data);
        else if (t === 'object') valid = typeof data === 'object' && !Array.isArray(data) && data !== null;
        else if (t === 'null') valid = data === null;
        if (!valid) errors.push(`${path || 'root'}: expected type "${t}", got ${Array.isArray(data) ? 'array' : typeof data}`);
    }

    // Required fields
    if (schema.required && typeof data === 'object' && data !== null) {
        for (const key of schema.required) {
            if (!(key in data)) errors.push(`${path || 'root'}: missing required field "${key}"`);
        }
    }

    // Properties (recursive)
    if (schema.properties && typeof data === 'object' && data !== null) {
        for (const [key, propSchema] of Object.entries(schema.properties)) {
            if (key in data) {
                errors.push(...validateJsonSchema(data[key], propSchema, path ? `${path}.${key}` : key));
            }
        }
    }

    // Array items
    if (schema.items && Array.isArray(data)) {
        data.forEach((item, i) => errors.push(...validateJsonSchema(item, schema.items, `${path || 'root'}[${i}]`)));
    }

    // Enum
    if (schema.enum && !schema.enum.includes(data)) {
        errors.push(`${path || 'root'}: value must be one of [${schema.enum.join(', ')}]`);
    }

    // String constraints
    if (typeof data === 'string') {
        if (schema.minLength !== undefined && data.length < schema.minLength) errors.push(`${path || 'root'}: length ${data.length} < minLength ${schema.minLength}`);
        if (schema.maxLength !== undefined && data.length > schema.maxLength) errors.push(`${path || 'root'}: length ${data.length} > maxLength ${schema.maxLength}`);
    }

    // Number constraints
    if (typeof data === 'number') {
        if (schema.minimum !== undefined && data < schema.minimum) errors.push(`${path || 'root'}: ${data} < minimum ${schema.minimum}`);
        if (schema.maximum !== undefined && data > schema.maximum) errors.push(`${path || 'root'}: ${data} > maximum ${schema.maximum}`);
    }

    return errors;
}

/**
 * Get value at a JSON path (dot notation with array index support)
 */
function getByPath(obj, path) {
    if (!path || !obj) return undefined;
    return path.split('.').reduce((curr, key) => {
        if (curr == null) return undefined;
        const idx = parseInt(key);
        if (!isNaN(idx) && Array.isArray(curr)) return curr[idx];
        return curr[key];
    }, obj);
}

/**
 * Compare two values based on a comparison operator.
 */
function compare(actual, comparison, expected) {
    switch (comparison) {
        case 'equals':
            return String(actual) === String(expected);
        case 'not_equals':
            return String(actual) !== String(expected);
        case 'greater_than':
            return Number(actual) > Number(expected);
        case 'less_than':
            return Number(actual) < Number(expected);
        case 'greater_than_or_equal':
            return Number(actual) >= Number(expected);
        case 'less_than_or_equal':
            return Number(actual) <= Number(expected);
        case 'contains':
            return String(actual).includes(String(expected));
        case 'not_contains':
            return !String(actual).includes(String(expected));
        case 'starts_with':
            return String(actual).startsWith(String(expected));
        case 'ends_with':
            return String(actual).endsWith(String(expected));
        case 'matches_regex':
            try { return new RegExp(expected).test(String(actual)); } catch { return false; }
        case 'exists':
            return actual !== undefined && actual !== null;
        case 'is_empty':
            return actual === '' || actual === null || actual === undefined || (Array.isArray(actual) && actual.length === 0) || (typeof actual === 'object' && actual !== null && Object.keys(actual).length === 0);
        case 'is_not_empty':
            return actual !== '' && actual !== null && actual !== undefined && !(Array.isArray(actual) && actual.length === 0) && !(typeof actual === 'object' && actual !== null && Object.keys(actual).length === 0);
        case 'is_null':
            return actual === null || actual === undefined;
        case 'is_not_null':
            return actual !== null && actual !== undefined;
        case 'length_equals':
            if (actual == null) return false;
            return (actual.length ?? Object.keys(actual).length) === Number(expected);
        case 'length_greater_than':
            if (actual == null) return false;
            return (actual.length ?? Object.keys(actual).length) > Number(expected);
        case 'length_less_than':
            if (actual == null) return false;
            return (actual.length ?? Object.keys(actual).length) < Number(expected);
        case 'is_type': {
            const t = expected.toLowerCase();
            if (t === 'array') return Array.isArray(actual);
            if (t === 'object') return typeof actual === 'object' && !Array.isArray(actual) && actual !== null;
            return typeof actual === t;
        }
        default:
            return false;
    }
}

/**
 * Evaluate a single assertion against a response.
 *
 * @param {Object} assertion
 * @param {Object} response - { status, statusText, data, headers, success }
 * @param {number} responseTime - ms
 * @returns {{ passed: boolean, message: string }}
 */
function evaluateOne(assertion, response, responseTime) {
    try {
        switch (assertion.type) {
            case 'status_code': {
                const actual = response.status;
                const passed = compare(actual, assertion.comparison || 'equals', assertion.expected);
                return {
                    passed,
                    message: passed
                        ? `Status ${actual} ${assertion.comparison || 'equals'} ${assertion.expected}`
                        : `Expected status ${assertion.comparison || 'equals'} ${assertion.expected}, got ${actual}`,
                };
            }

            case 'response_time': {
                const actual = responseTime || 0;
                const passed = compare(actual, assertion.comparison || 'less_than', assertion.expected);
                return {
                    passed,
                    message: passed
                        ? `Response time ${actual}ms ${assertion.comparison || 'less_than'} ${assertion.expected}ms`
                        : `Expected time ${assertion.comparison || 'less_than'} ${assertion.expected}ms, got ${actual}ms`,
                };
            }

            case 'body_contains': {
                const bodyStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');
                const passed = bodyStr.includes(assertion.expected || '');
                return {
                    passed,
                    message: passed
                        ? `Body contains "${assertion.expected}"`
                        : `Body does not contain "${assertion.expected}"`,
                };
            }

            case 'body_not_contains': {
                const bodyStr = typeof response.data === 'string' ? response.data : JSON.stringify(response.data || '');
                const passed = !bodyStr.includes(assertion.expected || '');
                return {
                    passed,
                    message: passed
                        ? `Body does not contain "${assertion.expected}"`
                        : `Body unexpectedly contains "${assertion.expected}"`,
                };
            }

            case 'json_path': {
                const data = typeof response.data === 'string' ? (() => { try { return JSON.parse(response.data); } catch { return response.data; } })() : response.data;
                const actual = getByPath(data, assertion.target);
                const passed = compare(actual, assertion.comparison || 'equals', assertion.expected);
                const displayActual = actual === undefined ? 'undefined' : JSON.stringify(actual);
                return {
                    passed,
                    message: passed
                        ? `$.${assertion.target} ${assertion.comparison || 'equals'} ${assertion.expected}`
                        : `$.${assertion.target}: expected ${assertion.comparison || 'equals'} "${assertion.expected}", got ${displayActual}`,
                };
            }

            case 'header_contains': {
                const headers = response.headers || {};
                // Case-insensitive header lookup
                const headerKey = Object.keys(headers).find(k => k.toLowerCase() === (assertion.target || '').toLowerCase());
                const headerVal = headerKey ? headers[headerKey] : undefined;
                const passed = headerVal !== undefined && String(headerVal).includes(assertion.expected || '');
                return {
                    passed,
                    message: passed
                        ? `Header "${assertion.target}" contains "${assertion.expected}"`
                        : headerVal === undefined
                            ? `Header "${assertion.target}" not found`
                            : `Header "${assertion.target}" = "${headerVal}", expected to contain "${assertion.expected}"`,
                };
            }

            case 'body_json_schema': {
                const data = typeof response.data === 'string' ? (() => { try { return JSON.parse(response.data); } catch { return response.data; } })() : response.data;
                let schema;
                try { schema = JSON.parse(assertion.expected); } catch { return { passed: false, message: 'Invalid JSON schema in expected value' }; }
                const errors = validateJsonSchema(data, schema);
                const passed = errors.length === 0;
                return {
                    passed,
                    message: passed
                        ? 'Response body matches JSON schema'
                        : `Schema validation failed: ${errors.slice(0, 3).join('; ')}`,
                };
            }

            default:
                return { passed: false, message: `Unknown assertion type: ${assertion.type}` };
        }
    } catch (err) {
        return { passed: false, message: `Assertion error: ${err.message}` };
    }
}

/**
 * Evaluate all assertions for a request against its response.
 *
 * @param {Array} assertions - Array of assertion objects
 * @param {Object} response - The API response
 * @param {number} responseTime - Response time in ms
 * @returns {{ results: Array<{ id, name, type, passed, message }>, passed: number, failed: number, total: number }}
 */
export function evaluateAssertions(assertions, response, responseTime) {
    if (!assertions || assertions.length === 0) {
        return { results: [], passed: 0, failed: 0, total: 0 };
    }

    const enabledAssertions = assertions.filter(a => a.enabled !== false);
    const results = enabledAssertions.map(assertion => {
        const result = evaluateOne(assertion, response, responseTime);
        return {
            id: assertion.id,
            name: getAssertionLabel(assertion),
            type: assertion.type,
            ...result,
        };
    });

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    return { results, passed, failed, total: results.length };
}

/**
 * Human-readable label for an assertion.
 */
export function getAssertionLabel(assertion) {
    switch (assertion.type) {
        case 'status_code':
            return `Status ${assertion.comparison || 'equals'} ${assertion.expected}`;
        case 'response_time':
            return `Time ${assertion.comparison || 'less_than'} ${assertion.expected}ms`;
        case 'body_contains':
            return `Body contains "${assertion.expected}"`;
        case 'body_not_contains':
            return `Body doesn't contain "${assertion.expected}"`;
        case 'json_path':
            return `$.${assertion.target} ${assertion.comparison || 'equals'} ${assertion.expected}`;
        case 'header_contains':
            return `Header ${assertion.target} contains "${assertion.expected}"`;
        case 'body_json_schema':
            return 'Body matches JSON schema';
        default:
            return assertion.type;
    }
}

/**
 * Create a default assertion template.
 */
export function createAssertion(type = 'status_code') {
    const defaults = {
        status_code: { target: '', comparison: 'equals', expected: '200' },
        response_time: { target: '', comparison: 'less_than', expected: '2000' },
        body_contains: { target: '', comparison: 'contains', expected: '' },
        body_not_contains: { target: '', comparison: 'not_contains', expected: '' },
        json_path: { target: '', comparison: 'equals', expected: '' },
        header_contains: { target: 'content-type', comparison: 'contains', expected: 'json' },
        body_json_schema: { target: '', expected: '{"type":"object","required":[]}' },
    };

    return {
        id: crypto.randomUUID ? crypto.randomUUID() : `a-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type,
        enabled: true,
        ...(defaults[type] || defaults.status_code),
    };
}
