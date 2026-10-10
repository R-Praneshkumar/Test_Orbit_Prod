/**
 * Script Execution Engine
 *
 * Provides a Postman-compatible pm.* API for pre-request and post-response scripts.
 * Trusted scripts run in a Web Worker with a 5-second timeout guard.
 * A Worker is not a complete security boundary for hostile imported JavaScript.
 * If a script runs longer than SCRIPT_TIMEOUT_MS (e.g., while(true){}), the worker
 * is terminated and an error is returned.
 */

// Maximum script execution time in milliseconds
const SCRIPT_TIMEOUT_MS = 5000;

// ---------------------------------------------------------------------------
// Web Worker code (runs in an isolated thread)
// ---------------------------------------------------------------------------
const WORKER_CODE = `"use strict";

// Harden the sandbox: strip network + escape-reachable capabilities from the worker
// global. Shadowing the parameters below is not enough on its own — a user script can
// recover the real global via the Function constructor (Function("return this")()).
// This reduces accidental access; it is not a complete sandbox for hostile code.
try {
  self.fetch = undefined;
  self.XMLHttpRequest = undefined;
  self.WebSocket = undefined;
  self.EventSource = undefined;
  self.importScripts = undefined;
  self.Request = undefined;
  self.Response = undefined;
} catch (e) { /* ignore */ }

function buildExpect(value) {
  var beObj = {
    a: function(type) { if (typeof value !== type) throw new Error("Expected type \\"" + type + "\\" but got \\"" + typeof value + "\\""); },
    an: function(type) { if (typeof value !== type) throw new Error("Expected type \\"" + type + "\\" but got \\"" + typeof value + "\\""); },
    above: function(n) { if (!(value > n)) throw new Error("Expected " + value + " to be above " + n); },
    below: function(n) { if (!(value < n)) throw new Error("Expected " + value + " to be below " + n); },
  };
  Object.defineProperty(beObj, "true", {
    get: function() { if (value !== true) throw new Error("Expected true but got " + JSON.stringify(value)); }
  });
  Object.defineProperty(beObj, "false", {
    get: function() { if (value !== false) throw new Error("Expected false but got " + JSON.stringify(value)); }
  });
  Object.defineProperty(beObj, "ok", {
    get: function() { if (!value) throw new Error("Expected truthy value but got " + JSON.stringify(value)); }
  });
  Object.defineProperty(beObj, "null", {
    get: function() { if (value !== null) throw new Error("Expected null but got " + JSON.stringify(value)); }
  });
  Object.defineProperty(beObj, "undefined", {
    get: function() { if (value !== undefined) throw new Error("Expected undefined but got " + JSON.stringify(value)); }
  });

  var notBeObj = {};
  Object.defineProperty(notBeObj, "empty", {
    get: function() {
      if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === "string" && value.length === 0) || (typeof value === "object" && Object.keys(value).length === 0)) {
        throw new Error("Expected not empty but value is empty");
      }
    }
  });
  Object.defineProperty(notBeObj, "true", {
    get: function() { if (value === true) throw new Error("Expected not true"); }
  });
  Object.defineProperty(notBeObj, "false", {
    get: function() { if (value === false) throw new Error("Expected not false"); }
  });
  Object.defineProperty(notBeObj, "null", {
    get: function() { if (value === null) throw new Error("Expected not null"); }
  });
  Object.defineProperty(notBeObj, "undefined", {
    get: function() { if (value === undefined) throw new Error("Expected not undefined"); }
  });
  Object.defineProperty(notBeObj, "ok", {
    get: function() { if (value) throw new Error("Expected falsy value but got " + JSON.stringify(value)); }
  });

  return {
    to: {
      equal: function(expected) { if (value !== expected) throw new Error("Expected " + JSON.stringify(expected) + " but got " + JSON.stringify(value)); },
      eql: function(expected) { if (JSON.stringify(value) !== JSON.stringify(expected)) throw new Error("Deep equal failed"); },
      be: beObj,
      have: {
        status: function(code) { if (!value || value.status !== code) throw new Error("Expected status " + code + " but got " + (value && value.status)); },
        property: function(prop) { if (!(prop in value)) throw new Error("Missing property \\"" + prop + "\\""); },
        lengthOf: function(len) { if (!value || value.length !== len) throw new Error("Expected length " + len + " but got " + (value && value.length)); },
      },
      include: function(item) {
        if (typeof value === "string" && !value.includes(item)) throw new Error("String doesn\\u0027t include \\"" + item + "\\"");
        if (Array.isArray(value) && !value.includes(item)) throw new Error("Array doesn\\u0027t include " + JSON.stringify(item));
      },
      not: {
        equal: function(expected) { if (value === expected) throw new Error("Expected not equal to " + JSON.stringify(expected)); },
        be: notBeObj,
        include: function(item) {
          if (typeof value === "string" && value.includes(item)) throw new Error("String should not include \\"" + item + "\\"");
          if (Array.isArray(value) && value.includes(item)) throw new Error("Array should not include " + JSON.stringify(item));
        },
      },
    },
  };
}

self.onmessage = function(e) {
  var data = e.data;
  var script = data.script;
  var ctx = data.contextData;
  var varsCopy = Object.assign({}, ctx.variables);
  var envMapCopy = Object.assign({}, ctx.envMap);
  var consoleLogs = [];
  var testResults = [];

  var sandboxConsole = {
    log: function() { var a = Array.prototype.slice.call(arguments); consoleLogs.push(a.map(function(x) { return typeof x === "object" ? JSON.stringify(x) : String(x); }).join(" ")); },
    warn: function() { var a = Array.prototype.slice.call(arguments); consoleLogs.push("[WARN] " + a.map(function(x) { return typeof x === "object" ? JSON.stringify(x) : String(x); }).join(" ")); },
    error: function() { var a = Array.prototype.slice.call(arguments); consoleLogs.push("[ERROR] " + a.map(function(x) { return typeof x === "object" ? JSON.stringify(x) : String(x); }).join(" ")); },
    info: function() { var a = Array.prototype.slice.call(arguments); consoleLogs.push("[INFO] " + a.map(function(x) { return typeof x === "object" ? JSON.stringify(x) : String(x); }).join(" ")); },
  };

  var responseData = ctx.responseData;
  var responseTime = ctx.responseTime;
  var requestData = ctx.requestData;

  var pm = {
    variables: {
      get: function(key) { return varsCopy[key] !== undefined ? varsCopy[key] : undefined; },
      set: function(key, value) { varsCopy[key] = String(value); },
      toObject: function() { return Object.assign({}, varsCopy); },
    },
    environment: {
      get: function(key) { return envMapCopy[key] !== undefined ? envMapCopy[key] : undefined; },
      set: function(key, value) { envMapCopy[key] = String(value); },
      toObject: function() { return Object.assign({}, envMapCopy); },
    },
    request: requestData ? {
      url: requestData.url || "",
      method: requestData.method || "GET",
      headers: Object.freeze(Object.assign({}, requestData.headers || {})),
      body: requestData.body || "",
    } : null,
    response: responseData ? {
      status: responseData.status || 0,
      code: responseData.status || 0,
      statusText: responseData.statusText || "",
      time: responseTime || 0,
      responseTime: responseTime || 0,
      headers: Object.freeze(Object.assign({}, responseData.headers || {})),
      json: function() {
        if (typeof responseData.data === "object") return responseData.data;
        try { return JSON.parse(responseData.data); } catch(e) { return null; }
      },
      text: function() {
        if (typeof responseData.data === "string") return responseData.data;
        return JSON.stringify(responseData.data);
      },
    } : {
      status: 0, code: 0, statusText: "No response yet", time: 0, responseTime: 0,
      headers: {}, json: function() { return null; }, text: function() { return ""; },
    },
    test: function(name, fn) {
      try { fn(); testResults.push({ name: name, passed: true, error: null }); }
      catch(err) { testResults.push({ name: name, passed: false, error: err.message || String(err) }); }
    },
    expect: buildExpect,
  };

  var start = performance.now();
  try {
    var fn = new Function(
      "pm", "console", "expect",
      "window", "document", "globalThis", "self",
      "fetch", "XMLHttpRequest", "WebSocket", "EventSource",
      "localStorage", "sessionStorage", "indexedDB",
      "importScripts", "eval", "postMessage",
      script
    );
    fn(
      pm, sandboxConsole, pm.expect,
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined, undefined,
      undefined, undefined, undefined,
      undefined, undefined, undefined
    );
    self.postMessage({
      success: true, error: null,
      consoleLogs: consoleLogs, testResults: testResults,
      updatedVars: varsCopy, updatedEnvVars: envMapCopy,
      duration: Math.round(performance.now() - start),
    });
  } catch(err) {
    self.postMessage({
      success: false, error: err.message || String(err),
      consoleLogs: consoleLogs, testResults: testResults,
      updatedVars: varsCopy, updatedEnvVars: envMapCopy,
      duration: Math.round(performance.now() - start),
    });
  }
};
`;

// ---------------------------------------------------------------------------
// Blob URL management (created once, reused across calls)
// ---------------------------------------------------------------------------
let workerBlobUrl = null;

function getWorkerBlobUrl() {
    if (!workerBlobUrl) {
        const blob = new Blob([WORKER_CODE], { type: 'application/javascript' });
        workerBlobUrl = URL.createObjectURL(blob);
    }
    return workerBlobUrl;
}

// ---------------------------------------------------------------------------
// Context creation (used by sync fallback and exported for testing)
// ---------------------------------------------------------------------------

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

    /**
     * Build a chainable expect object using getters for boolean properties
     * so they only evaluate when accessed (not when the parent object is constructed).
     */
    const buildExpect = (value) => {
        const beObj = {
            a: (type) => { if (typeof value !== type) throw new Error(`Expected type "${type}" but got "${typeof value}"`); },
            an: (type) => { if (typeof value !== type) throw new Error(`Expected type "${type}" but got "${typeof value}"`); },
            above: (n) => { if (!(value > n)) throw new Error(`Expected ${value} to be above ${n}`); },
            below: (n) => { if (!(value < n)) throw new Error(`Expected ${value} to be below ${n}`); },
        };
        // Use defineProperty so .true and .false are evaluated lazily (on access), not eagerly
        Object.defineProperty(beObj, 'true', {
            get() { if (value !== true) throw new Error(`Expected true but got ${JSON.stringify(value)}`); return undefined; },
        });
        Object.defineProperty(beObj, 'false', {
            get() { if (value !== false) throw new Error(`Expected false but got ${JSON.stringify(value)}`); return undefined; },
        });
        Object.defineProperty(beObj, 'ok', {
            get() { if (!value) throw new Error(`Expected truthy value but got ${JSON.stringify(value)}`); return undefined; },
        });
        Object.defineProperty(beObj, 'null', {
            get() { if (value !== null) throw new Error(`Expected null but got ${JSON.stringify(value)}`); return undefined; },
        });
        Object.defineProperty(beObj, 'undefined', {
            get() { if (value !== undefined) throw new Error(`Expected undefined but got ${JSON.stringify(value)}`); return undefined; },
        });

        const notBeObj = {};
        Object.defineProperty(notBeObj, 'empty', {
            get() {
                if (!value || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && value.length === 0) || (typeof value === 'object' && Object.keys(value).length === 0)) {
                    throw new Error('Expected not empty but value is empty');
                }
                return undefined;
            },
        });
        Object.defineProperty(notBeObj, 'true', {
            get() { if (value === true) throw new Error('Expected not true'); return undefined; },
        });
        Object.defineProperty(notBeObj, 'false', {
            get() { if (value === false) throw new Error('Expected not false'); return undefined; },
        });
        Object.defineProperty(notBeObj, 'null', {
            get() { if (value === null) throw new Error('Expected not null'); return undefined; },
        });
        Object.defineProperty(notBeObj, 'undefined', {
            get() { if (value === undefined) throw new Error('Expected not undefined'); return undefined; },
        });
        Object.defineProperty(notBeObj, 'ok', {
            get() { if (value) throw new Error(`Expected falsy value but got ${JSON.stringify(value)}`); return undefined; },
        });

        return {
            to: {
                equal: (expected) => { if (value !== expected) throw new Error(`Expected ${JSON.stringify(expected)} but got ${JSON.stringify(value)}`); },
                eql: (expected) => { if (JSON.stringify(value) !== JSON.stringify(expected)) throw new Error(`Deep equal failed`); },
                be: beObj,
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
                    be: notBeObj,
                    include: (item) => {
                        if (typeof value === 'string' && value.includes(item)) throw new Error(`String should not include "${item}"`);
                        if (Array.isArray(value) && value.includes(item)) throw new Error(`Array should not include ${JSON.stringify(item)}`);
                    },
                },
            },
        };
    };

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
            code: response.status || 0,
            statusText: response.statusText || '',
            time: responseTime || 0,
            responseTime: responseTime || 0,
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
            code: 0,
            statusText: 'No response yet',
            time: 0,
            responseTime: 0,
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

        // --- Expect helper (chainable assertions using lazy getters) ---
        expect: buildExpect,
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

// ---------------------------------------------------------------------------
// Synchronous fallback (used when Web Workers are unavailable, e.g. tests)
// ---------------------------------------------------------------------------
function executeSyncFallback(script, pmContext) {
    const start = performance.now();
    try {
        const fn = new Function(
            'pm', 'console', 'expect',
            'window', 'document', 'globalThis', 'self',
            'fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource',
            'localStorage', 'sessionStorage', 'indexedDB',
            'importScripts', 'eval',
            script
        );
        fn(
            pmContext.pm, pmContext.sandboxConsole, pmContext.pm.expect,
            undefined, undefined, undefined, undefined,
            undefined, undefined, undefined, undefined,
            undefined, undefined, undefined,
            undefined, undefined
        );
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

// ---------------------------------------------------------------------------
// Main execution (async — uses Web Worker with timeout)
// ---------------------------------------------------------------------------

/**
 * Prepares serializable context data from raw script parameters.
 */
function serializeContextData({ variables = {}, environment = [], response = null, responseTime = null, request = null }) {
    const envMap = {};
    (environment || []).forEach(v => {
        if (v.enabled !== false && v.key) envMap[v.key] = v.value;
    });

    const responseData = response ? {
        status: response.status || 0,
        statusText: response.statusText || '',
        headers: { ...(response.headers || {}) },
        data: response.data,
    } : null;

    const requestData = request ? {
        url: request.url || '',
        method: request.method || 'GET',
        headers: { ...(request.resolvedHeaders || request.headers || {}) },
        body: request.body?.content || '',
    } : null;

    return { variables: { ...variables }, envMap, responseData, responseTime, requestData };
}

/**
 * Executes a user script in a Web Worker with a timeout guard.
 * Falls back to synchronous execution if Web Workers are unavailable.
 *
 * @param {string} script - The JavaScript code to execute
 * @param {Object} params - Script context parameters
 * @returns {Promise<{ success: boolean, error: string|null, consoleLogs: string[], testResults: Array, updatedVars: Object, updatedEnvVars: Object, duration: number }>}
 */
export async function executeScript(script, { variables = {}, environment = [], response = null, responseTime = null, request = null } = {}) {
    const contextData = serializeContextData({ variables, environment, response, responseTime, request });

    if (!script || !script.trim()) {
        return {
            success: true,
            error: null,
            consoleLogs: [],
            testResults: [],
            updatedVars: { ...contextData.variables },
            updatedEnvVars: { ...contextData.envMap },
            duration: 0,
        };
    }

    // Try Web Worker execution with timeout
    try {
        const worker = new Worker(getWorkerBlobUrl());

        return await new Promise((resolve) => {
            let settled = false;
            let timeoutId;

            const settle = (result) => {
                if (settled) return;
                settled = true;
                clearTimeout(timeoutId);
                worker.terminate();
                resolve(result);
            };

            worker.onmessage = (e) => settle(e.data);

            worker.onerror = (e) => settle({
                success: false,
                error: e.message || 'Script worker error',
                consoleLogs: [],
                testResults: [],
                updatedVars: { ...contextData.variables },
                updatedEnvVars: { ...contextData.envMap },
                duration: SCRIPT_TIMEOUT_MS,
            });

            timeoutId = setTimeout(() => {
                settle({
                    success: false,
                    error: `Script execution timed out after ${SCRIPT_TIMEOUT_MS / 1000} seconds. Check for infinite loops.`,
                    consoleLogs: [],
                    testResults: [],
                    updatedVars: { ...contextData.variables },
                    updatedEnvVars: { ...contextData.envMap },
                    duration: SCRIPT_TIMEOUT_MS,
                });
            }, SCRIPT_TIMEOUT_MS);

            worker.postMessage({ script, contextData });
        });
    } catch {
        // Web Workers unavailable (e.g. jsdom in tests) — synchronous fallback
        const pmContext = createPmContext({ variables, environment, response, responseTime, request });
        return executeSyncFallback(script, pmContext);
    }
}

/**
 * Convenience: run a pre-request script.
 */
export async function runPreRequestScript(script, { variables, environment, request }) {
    return executeScript(script, { variables, environment, request });
}

/**
 * Convenience: run a post-response script.
 */
export async function runPostResponseScript(script, { variables, environment, request, response, responseTime }) {
    return executeScript(script, { variables, environment, request, response, responseTime });
}
