/**
 * Sandboxed Script Execution Engine
 *
 * Provides a Postman-compatible pm.* API for pre-request and post-response scripts.
 * Scripts run in a Function constructor sandbox with a controlled scope.
 */

/**
 * Creates a pm context object with Postman-compatible APIs.
 *
 * @param {Object} options
 * @param {Object} options.variables       - Current chain variables { key: value }
 * @param {Object} options.environment     - Current environment variables [{ key, value, enabled }]
 * @param {Object|null} options.response   - Response data (null for pre-request scripts)
 * @param {number|null} options.responseTime - Response time in ms
 * @param {Object} options.request         - Current request object
 * @returns {{ pm: Object, consoleLogs: string[], testResults: Array, getUpdatedVars: Function, getUpdatedEnvVars: Function }}
 */
export function createPmContext({
    variables = {},
    environment = [],
    response = null,
    responseTime = null,
    request = null,
}) {
    // Mutable copies so scripts can modify them
    const varsCopy = { ...variables };
    const envMap = {};
    (environment || []).forEach(v => {
        if (v.enabled !== false && v.key) envMap[v.key] = v.value;
    });

    const consoleLogs = [];
    const testResults = [];

    const pm = {
        // --- Variables (chain vars — persist across requests) ---
        variables: {
            get: (key) => varsCopy[key] ?? undefined,
            set: (key, value) => { varsCopy[key] = String(value); },
            toObject: () => ({ ...varsCopy }),
        },

        // --- Environment ---
        environment: {
            get: (key) => envMap[key] ?? undefined,
            set: (key, value) => { envMap[key] = String(value); },
            toObject: () => ({ ...envMap }),
        },

        // --- Request (read-only) ---
        request: request ? {
            url: request.url || '',
            method: request.method || 'GET',
            headers: Object.freeze({ ...(request.resolvedHeaders || {}) }),
            body: request.body?.content || '',
        } : null,

        // --- Response (only available in post-response scripts) ---
        response: response ? {
            status: response.status || 0,
            statusText: response.statusText || '',
            time: responseTime || 0,
            headers: Object.freeze({ ...(response.headers || {}) }),
            json: () => {
                if (typeof response.data === 'object') return response.data;
                try { return JSON.parse(response.data); } catch { return null; }
            },
            text: () => {
                if (typeof response.data === 'string') return response.data;
                return JSON.stringify(response.data);
            },
        } : {
            status: 0,
            statusText: 'No response yet',
            time: 0,
            headers: {},
            json: () => null,
            text: () => '',
        },

        // --- Test assertions ---
        test: (name, fn) => {
            try {
                fn();
                testResults.push({ name, passed: true, error: null });
            } catch (err) {
                testResults.push({ name, passed: false, error: err.message || String(err) });
            }
        },

        // --- Expect helper (chainable assertions) ---
        expect: (value) => ({
            to: {
                equal: (expected) => { if (value !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`); },
                eql: (expected) => { if (JSON.stringify(value) !== JSON.stringify(expected)) throw new Error(`Deep equal failed`); },
                be: {
                    a: (type) => { if (typeof value !== type) throw new Error(`Expected type "${type}" but got "${typeof value}"`); },
                    an: (type) => { if (typeof value !== type) throw new Error(`Expected type "${type}" but got "${typeof value}"`); },
                    above: (n) => { if (!(value > n)) throw new Error(`Expected ${value} to be above ${n}`); },
                    below: (n) => { if (!(value < n)) throw new Error(`Expected ${value} to be below ${n}`); },
                    true: (() => { if (value !== true) throw new Error(`Expected true but got ${value}`); }),
                    false: (() => { if (value !== false) throw new Error(`Expected false but got ${value}`); }),
                },
                have: {
                    status: (code) => { if (value?.status !== code) throw new Error(`Expected status ${code} but got ${value?.status}`); },
                    property: (prop) => { if (!(prop in value)) throw new Error(`Missing property "${prop}"`); },
                    lengthOf: (len) => { if (value?.length !== len) throw new Error(`Expected length ${len} but got ${value?.length}`); },
                },
                include: (item) => {
                    if (typeof value === 'string' && !value.includes(item)) throw new Error(`String doesn't include "${item}"`);
                    if (Array.isArray(value) && !value.includes(item)) throw new Error(`Array doesn't include ${JSON.stringify(item)}`);
                },
                not: {
                    equal: (expected) => { if (value === expected) throw new Error(`Expected not equal to ${JSON.stringify(expected)}`); },
                    be: {
                        empty: (() => { if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === 'object' && Object.keys(value).length === 0)) throw new Error('Expected not empty'); }),
                    },
                },
            },
        }),
    };

    // Sandboxed console
    const sandboxConsole = {
        log: (...args) => consoleLogs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        warn: (...args) => consoleLogs.push('[WARN] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        error: (...args) => consoleLogs.push('[ERROR] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
        info: (...args) => consoleLogs.push('[INFO] ' + args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    };

    return {
        pm,
        sandboxConsole,
        consoleLogs,
        testResults,
        getUpdatedVars: () => varsCopy,
        getUpdatedEnvVars: () => envMap,
    };
}

/**
 * Executes a user script in a sandboxed context.
 *
 * @param {string} script - The JavaScript code to execute
 * @param {Object} pmContext - The context from createPmContext()
 * @returns {{ success: boolean, error: string|null, consoleLogs: string[], testResults: Array, updatedVars: Object, updatedEnvVars: Object, duration: number }}
 */
export function executeScript(script, pmContext) {
    if (!script || !script.trim()) {
        return {
            success: true,
            error: null,
            consoleLogs: [],
            testResults: [],
            updatedVars: pmContext.getUpdatedVars(),
            updatedEnvVars: pmContext.getUpdatedEnvVars(),
            duration: 0,
        };
    }

    const start = performance.now();

    try {
        // Create a sandboxed function with controlled scope
        // The function receives pm, console, and expect as arguments
        const fn = new Function('pm', 'console', 'expect', script);
        fn(pmContext.pm, pmContext.sandboxConsole, pmContext.pm.expect);

        return {
            success: true,
            error: null,
            consoleLogs: [...pmContext.consoleLogs],
            testResults: [...pmContext.testResults],
            updatedVars: pmContext.getUpdatedVars(),
            updatedEnvVars: pmContext.getUpdatedEnvVars(),
            duration: Math.round(performance.now() - start),
        };
    } catch (err) {
        return {
            success: false,
            error: err.message || String(err),
            consoleLogs: [...pmContext.consoleLogs],
            testResults: [...pmContext.testResults],
            updatedVars: pmContext.getUpdatedVars(),
            updatedEnvVars: pmContext.getUpdatedEnvVars(),
            duration: Math.round(performance.now() - start),
        };
    }
}

/**
 * Convenience: run a pre-request script.
 */
export function runPreRequestScript(script, { variables, environment, request }) {
    const ctx = createPmContext({ variables, environment, request, response: null, responseTime: null });
    return executeScript(script, ctx);
}

/**
 * Convenience: run a post-response script.
 */
export function runPostResponseScript(script, { variables, environment, request, response, responseTime }) {
    const ctx = createPmContext({ variables, environment, request, response, responseTime });
    return executeScript(script, ctx);
}
