import { describe, it, expect } from 'vitest';
import { createPmContext, executeScript, runPreRequestScript, runPostResponseScript } from '../utils/scriptEngine';

// Fixtures
const ENV_VARS = [
    { key: 'baseUrl', value: 'https://api.test.com', enabled: true },
    { key: 'token', value: 'abc123', enabled: true },
    { key: 'disabled', value: 'skip', enabled: false },
    { key: '', value: 'empty-key', enabled: true },
];

const RESPONSE = {
    status: 200,
    statusText: 'OK',
    data: { id: 1, name: 'Alice', roles: ['admin'] },
    headers: { 'Content-Type': 'application/json' },
};

const REQUEST = {
    url: 'https://api.test.com/users',
    method: 'POST',
    resolvedHeaders: { 'Authorization': 'Bearer abc123' },
    body: { type: 'json', content: '{"name":"Alice"}' },
};

// ─── createPmContext ─────────────────────────────────────────────

describe('createPmContext', () => {
    describe('pm.variables', () => {
        it('get returns set variable', () => {
            const { pm } = createPmContext({ variables: { foo: 'bar' } });
            expect(pm.variables.get('foo')).toBe('bar');
        });

        it('get returns undefined for missing key', () => {
            const { pm } = createPmContext({});
            expect(pm.variables.get('nope')).toBeUndefined();
        });

        it('set stores a variable', () => {
            const { pm, getUpdatedVars } = createPmContext({});
            pm.variables.set('key', 'value');
            expect(pm.variables.get('key')).toBe('value');
            expect(getUpdatedVars().key).toBe('value');
        });

        it('set converts value to string', () => {
            const { pm } = createPmContext({});
            pm.variables.set('num', 42);
            expect(pm.variables.get('num')).toBe('42');
        });

        it('toObject returns a copy', () => {
            const { pm } = createPmContext({ variables: { a: '1' } });
            const obj = pm.variables.toObject();
            expect(obj).toEqual({ a: '1' });
            obj.a = '99';
            expect(pm.variables.get('a')).toBe('1'); // original unchanged
        });

        it('does not mutate original variables', () => {
            const original = { x: 'orig' };
            const { pm } = createPmContext({ variables: original });
            pm.variables.set('x', 'changed');
            expect(original.x).toBe('orig');
        });
    });

    describe('pm.environment', () => {
        it('get returns enabled env var', () => {
            const { pm } = createPmContext({ environment: ENV_VARS });
            expect(pm.environment.get('baseUrl')).toBe('https://api.test.com');
            expect(pm.environment.get('token')).toBe('abc123');
        });

        it('skips disabled env vars', () => {
            const { pm } = createPmContext({ environment: ENV_VARS });
            expect(pm.environment.get('disabled')).toBeUndefined();
        });

        it('skips empty-key env vars', () => {
            const { pm } = createPmContext({ environment: ENV_VARS });
            expect(pm.environment.get('')).toBeUndefined();
        });

        it('get returns undefined for missing key', () => {
            const { pm } = createPmContext({ environment: ENV_VARS });
            expect(pm.environment.get('nope')).toBeUndefined();
        });

        it('set stores env var', () => {
            const { pm, getUpdatedEnvVars } = createPmContext({ environment: ENV_VARS });
            pm.environment.set('newKey', 'newVal');
            expect(pm.environment.get('newKey')).toBe('newVal');
            expect(getUpdatedEnvVars().newKey).toBe('newVal');
        });

        it('set converts value to string', () => {
            const { pm } = createPmContext({ environment: [] });
            pm.environment.set('bool', true);
            expect(pm.environment.get('bool')).toBe('true');
        });

        it('toObject returns a copy', () => {
            const { pm } = createPmContext({ environment: ENV_VARS });
            const obj = pm.environment.toObject();
            expect(obj.baseUrl).toBe('https://api.test.com');
            obj.baseUrl = 'changed';
            expect(pm.environment.get('baseUrl')).toBe('https://api.test.com');
        });

        it('handles null environment', () => {
            const { pm } = createPmContext({ environment: null });
            expect(pm.environment.get('anything')).toBeUndefined();
        });
    });

    describe('pm.request', () => {
        it('exposes request fields', () => {
            const { pm } = createPmContext({ request: REQUEST });
            expect(pm.request.url).toBe('https://api.test.com/users');
            expect(pm.request.method).toBe('POST');
            expect(pm.request.body).toBe('{"name":"Alice"}');
        });

        it('exposes frozen headers', () => {
            const { pm } = createPmContext({ request: REQUEST });
            expect(pm.request.headers.Authorization).toBe('Bearer abc123');
            expect(() => { pm.request.headers.newKey = 'val'; }).toThrow();
        });

        it('is null when no request provided', () => {
            const { pm } = createPmContext({});
            expect(pm.request).toBeNull();
        });

        it('defaults method to GET', () => {
            const { pm } = createPmContext({ request: { url: '/test' } });
            expect(pm.request.method).toBe('GET');
        });
    });

    describe('pm.response', () => {
        it('exposes response fields', () => {
            const { pm } = createPmContext({ response: RESPONSE, responseTime: 150 });
            expect(pm.response.status).toBe(200);
            expect(pm.response.code).toBe(200);
            expect(pm.response.statusText).toBe('OK');
            expect(pm.response.time).toBe(150);
            expect(pm.response.responseTime).toBe(150);
        });

        it('json() returns parsed object body', () => {
            const { pm } = createPmContext({ response: RESPONSE });
            expect(pm.response.json()).toEqual({ id: 1, name: 'Alice', roles: ['admin'] });
        });

        it('json() parses string body', () => {
            const { pm } = createPmContext({ response: { ...RESPONSE, data: '{"x":1}' } });
            expect(pm.response.json()).toEqual({ x: 1 });
        });

        it('json() returns null for unparseable string', () => {
            const { pm } = createPmContext({ response: { ...RESPONSE, data: 'not json' } });
            expect(pm.response.json()).toBeNull();
        });

        it('text() returns string body as-is', () => {
            const { pm } = createPmContext({ response: { ...RESPONSE, data: 'hello' } });
            expect(pm.response.text()).toBe('hello');
        });

        it('text() stringifies object body', () => {
            const { pm } = createPmContext({ response: RESPONSE });
            expect(pm.response.text()).toBe(JSON.stringify(RESPONSE.data));
        });

        it('has frozen headers', () => {
            const { pm } = createPmContext({ response: RESPONSE });
            expect(pm.response.headers['Content-Type']).toBe('application/json');
            expect(() => { pm.response.headers.x = 'y'; }).toThrow();
        });

        it('provides stub when no response', () => {
            const { pm } = createPmContext({});
            expect(pm.response.status).toBe(0);
            expect(pm.response.statusText).toBe('No response yet');
            expect(pm.response.json()).toBeNull();
            expect(pm.response.text()).toBe('');
        });
    });

    describe('pm.test', () => {
        it('records passing test', () => {
            const { pm, testResults } = createPmContext({});
            pm.test('it works', () => { /* no throw */ });
            expect(testResults).toHaveLength(1);
            expect(testResults[0]).toEqual({ name: 'it works', passed: true, error: null });
        });

        it('records failing test', () => {
            const { pm, testResults } = createPmContext({});
            pm.test('it fails', () => { throw new Error('oops'); });
            expect(testResults).toHaveLength(1);
            expect(testResults[0].passed).toBe(false);
            expect(testResults[0].error).toBe('oops');
        });

        it('handles non-Error throws', () => {
            const { pm, testResults } = createPmContext({});
            pm.test('string throw', () => { throw 'bad'; });
            expect(testResults[0].passed).toBe(false);
            expect(testResults[0].error).toBe('bad');
        });

        it('multiple tests accumulate', () => {
            const { pm, testResults } = createPmContext({});
            pm.test('a', () => {});
            pm.test('b', () => { throw new Error('fail'); });
            pm.test('c', () => {});
            expect(testResults).toHaveLength(3);
            expect(testResults.filter(t => t.passed)).toHaveLength(2);
        });
    });

    describe('pm.expect — to.be', () => {
        it('.true passes for true', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(true).to.be.true).not.toThrow();
        });

        it('.true throws for false', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(false).to.be.true).toThrow(/Expected true/);
        });

        it('.false passes for false', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(false).to.be.false).not.toThrow();
        });

        it('.false throws for true', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(true).to.be.false).toThrow(/Expected false/);
        });

        it('.ok passes for truthy', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(1).to.be.ok).not.toThrow();
            expect(() => pm.expect('yes').to.be.ok).not.toThrow();
        });

        it('.ok throws for falsy', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(0).to.be.ok).toThrow(/truthy/);
            expect(() => pm.expect('').to.be.ok).toThrow(/truthy/);
        });

        it('.null passes for null', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(null).to.be.null).not.toThrow();
        });

        it('.null throws for non-null', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(42).to.be.null).toThrow(/Expected null/);
        });

        it('.undefined passes for undefined', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(undefined).to.be.undefined).not.toThrow();
        });

        it('.undefined throws for defined', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect('x').to.be.undefined).toThrow(/Expected undefined/);
        });

        it('.a(type) checks typeof', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect('hello').to.be.a('string')).not.toThrow();
            expect(() => pm.expect(42).to.be.a('string')).toThrow(/Expected type/);
        });

        it('.an(type) is an alias for .a()', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect({}).to.be.an('object')).not.toThrow();
        });

        it('.above(n) and .below(n)', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(10).to.be.above(5)).not.toThrow();
            expect(() => pm.expect(10).to.be.above(10)).toThrow(/above/);
            expect(() => pm.expect(5).to.be.below(10)).not.toThrow();
            expect(() => pm.expect(10).to.be.below(10)).toThrow(/below/);
        });
    });

    describe('pm.expect — to.equal / to.eql', () => {
        it('equal checks strict equality', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(42).to.equal(42)).not.toThrow();
            expect(() => pm.expect('42').to.equal(42)).toThrow();
        });

        it('eql checks deep equality', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect({ a: 1 }).to.eql({ a: 1 })).not.toThrow();
            expect(() => pm.expect({ a: 1 }).to.eql({ a: 2 })).toThrow(/Deep equal/);
        });
    });

    describe('pm.expect — to.have', () => {
        it('.status(code)', () => {
            const { pm } = createPmContext({});
            const resp = { status: 200 };
            expect(() => pm.expect(resp).to.have.status(200)).not.toThrow();
            expect(() => pm.expect(resp).to.have.status(404)).toThrow(/status/);
        });

        it('.property(prop)', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect({ name: 'A' }).to.have.property('name')).not.toThrow();
            expect(() => pm.expect({ name: 'A' }).to.have.property('age')).toThrow(/Missing property/);
        });

        it('.lengthOf(n)', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect([1, 2, 3]).to.have.lengthOf(3)).not.toThrow();
            expect(() => pm.expect([1, 2]).to.have.lengthOf(5)).toThrow(/length/);
        });
    });

    describe('pm.expect — to.include', () => {
        it('string includes', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect('hello world').to.include('world')).not.toThrow();
            expect(() => pm.expect('hello').to.include('xyz')).toThrow(/include/);
        });

        it('array includes', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect([1, 2, 3]).to.include(2)).not.toThrow();
            expect(() => pm.expect([1, 2]).to.include(9)).toThrow(/include/);
        });
    });

    describe('pm.expect — to.not', () => {
        it('.equal checks not equal', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(1).to.not.equal(2)).not.toThrow();
            expect(() => pm.expect(1).to.not.equal(1)).toThrow(/not equal/);
        });

        it('.include (string)', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect('hello').to.not.include('xyz')).not.toThrow();
            expect(() => pm.expect('hello').to.not.include('ell')).toThrow(/should not include/);
        });

        it('.include (array)', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect([1, 2]).to.not.include(3)).not.toThrow();
            expect(() => pm.expect([1, 2]).to.not.include(1)).toThrow(/should not include/);
        });

        it('.be.true throws for true', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(true).to.not.be.true).toThrow(/not true/);
        });

        it('.be.false throws for false', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(false).to.not.be.false).toThrow(/not false/);
        });

        it('.be.null throws for null', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(null).to.not.be.null).toThrow(/not null/);
        });

        it('.be.undefined throws for undefined', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(undefined).to.not.be.undefined).toThrow(/not undefined/);
        });

        it('.be.ok throws for truthy', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect(1).to.not.be.ok).toThrow(/falsy/);
            expect(() => pm.expect(0).to.not.be.ok).not.toThrow();
        });

        it('.be.empty throws for empty', () => {
            const { pm } = createPmContext({});
            expect(() => pm.expect([1, 2]).to.not.be.empty).not.toThrow();
            expect(() => pm.expect([]).to.not.be.empty).toThrow(/empty/);
            expect(() => pm.expect('').to.not.be.empty).toThrow(/empty/);
            expect(() => pm.expect({}).to.not.be.empty).toThrow(/empty/);
        });
    });

    describe('sandboxConsole', () => {
        it('log captures output', () => {
            const { sandboxConsole, consoleLogs } = createPmContext({});
            sandboxConsole.log('hello', 'world');
            expect(consoleLogs).toEqual(['hello world']);
        });

        it('warn prefixes with [WARN]', () => {
            const { sandboxConsole, consoleLogs } = createPmContext({});
            sandboxConsole.warn('careful');
            expect(consoleLogs).toEqual(['[WARN] careful']);
        });

        it('error prefixes with [ERROR]', () => {
            const { sandboxConsole, consoleLogs } = createPmContext({});
            sandboxConsole.error('bad');
            expect(consoleLogs).toEqual(['[ERROR] bad']);
        });

        it('info prefixes with [INFO]', () => {
            const { sandboxConsole, consoleLogs } = createPmContext({});
            sandboxConsole.info('note');
            expect(consoleLogs).toEqual(['[INFO] note']);
        });

        it('serializes objects to JSON', () => {
            const { sandboxConsole, consoleLogs } = createPmContext({});
            sandboxConsole.log({ x: 1 });
            expect(consoleLogs[0]).toBe('{"x":1}');
        });

        it('converts non-string primitives', () => {
            const { sandboxConsole, consoleLogs } = createPmContext({});
            sandboxConsole.log(42, true, null);
            expect(consoleLogs[0]).toBe('42 true null');
        });
    });

    describe('getUpdatedVars / getUpdatedEnvVars', () => {
        it('tracks variable mutations', () => {
            const { pm, getUpdatedVars } = createPmContext({ variables: { a: '1' } });
            pm.variables.set('b', '2');
            expect(getUpdatedVars()).toEqual({ a: '1', b: '2' });
        });

        it('tracks env var mutations', () => {
            const { pm, getUpdatedEnvVars } = createPmContext({ environment: ENV_VARS });
            pm.environment.set('newVar', 'hello');
            const envs = getUpdatedEnvVars();
            expect(envs.baseUrl).toBe('https://api.test.com');
            expect(envs.newVar).toBe('hello');
            expect(envs.disabled).toBeUndefined(); // was disabled
        });
    });
});

// ─── executeScript (sync fallback in jsdom) ──────────────────────

describe('executeScript', () => {
    it('returns success for empty script', async () => {
        const result = await executeScript('');
        expect(result.success).toBe(true);
        expect(result.consoleLogs).toEqual([]);
        expect(result.testResults).toEqual([]);
        expect(result.duration).toBe(0);
    });

    it('returns success for whitespace-only script', async () => {
        const result = await executeScript('   \n  ');
        expect(result.success).toBe(true);
    });

    it('executes simple console.log', async () => {
        const result = await executeScript('console.log("hello from script")');
        expect(result.success).toBe(true);
        expect(result.consoleLogs).toContain('hello from script');
    });

    it('provides pm.variables.get/set', async () => {
        const result = await executeScript(
            'pm.variables.set("color", "blue"); console.log(pm.variables.get("color"))',
            { variables: {} }
        );
        expect(result.success).toBe(true);
        expect(result.updatedVars.color).toBe('blue');
        expect(result.consoleLogs).toContain('blue');
    });

    it('provides pm.environment.get/set', async () => {
        const result = await executeScript(
            'pm.environment.set("apiKey", "xyz"); console.log(pm.environment.get("host"))',
            { environment: [{ key: 'host', value: 'localhost', enabled: true }] }
        );
        expect(result.success).toBe(true);
        expect(result.updatedEnvVars.apiKey).toBe('xyz');
        expect(result.consoleLogs).toContain('localhost');
    });

    it('provides pm.response.json()', async () => {
        const result = await executeScript(
            'var data = pm.response.json(); console.log(data.name)',
            { response: RESPONSE, responseTime: 100 }
        );
        expect(result.success).toBe(true);
        expect(result.consoleLogs).toContain('Alice');
    });

    it('provides pm.response.text()', async () => {
        const result = await executeScript(
            'console.log(pm.response.text())',
            { response: { ...RESPONSE, data: 'plain text' } }
        );
        expect(result.success).toBe(true);
        expect(result.consoleLogs).toContain('plain text');
    });

    it('provides pm.response status fields', async () => {
        const result = await executeScript(
            'console.log(pm.response.status); console.log(pm.response.code); console.log(pm.response.statusText)',
            { response: RESPONSE }
        );
        expect(result.success).toBe(true);
        expect(result.consoleLogs).toEqual(['200', '200', 'OK']);
    });

    it('records pm.test results', async () => {
        const result = await executeScript(`
            pm.test("status is 200", function() {
                pm.expect(pm.response.status).to.equal(200);
            });
            pm.test("has name", function() {
                pm.expect(pm.response.json().name).to.equal("Alice");
            });
        `, { response: RESPONSE });
        expect(result.success).toBe(true);
        expect(result.testResults).toHaveLength(2);
        expect(result.testResults.every(t => t.passed)).toBe(true);
    });

    it('records failed pm.test', async () => {
        const result = await executeScript(`
            pm.test("wrong status", function() {
                pm.expect(pm.response.status).to.equal(404);
            });
        `, { response: RESPONSE });
        expect(result.success).toBe(true); // script itself succeeded
        expect(result.testResults[0].passed).toBe(false);
        expect(result.testResults[0].error).toContain('404');
    });

    it('pm.expect().to.be.true works in script', async () => {
        const result = await executeScript(`
            pm.test("boolean check", function() {
                pm.expect(true).to.be.true;
                pm.expect(false).to.be.false;
            });
        `, { response: RESPONSE });
        expect(result.testResults[0].passed).toBe(true);
    });

    it('pm.expect().to.not.be.true works in script', async () => {
        const result = await executeScript(`
            pm.test("negation", function() {
                pm.expect(false).to.not.be.true;
            });
        `, { response: RESPONSE });
        expect(result.testResults[0].passed).toBe(true);
    });

    it('returns error for syntax error in script', async () => {
        const result = await executeScript('function(');
        expect(result.success).toBe(false);
        expect(result.error).toBeTruthy();
    });

    it('returns error for runtime error in script', async () => {
        const result = await executeScript('throw new Error("boom")');
        expect(result.success).toBe(false);
        expect(result.error).toBe('boom');
    });

    it('preserves console logs and test results even on error', async () => {
        const result = await executeScript(`
            console.log("before");
            pm.test("pass", function() {});
            throw new Error("crash");
        `);
        expect(result.success).toBe(false);
        expect(result.consoleLogs).toContain('before');
        expect(result.testResults).toHaveLength(1);
    });

    it('shadows dangerous globals', async () => {
        // In the sync fallback, window/document/fetch etc are passed as undefined
        const result = await executeScript(`
            pm.test("window is shadowed", function() {
                pm.expect(typeof window).to.equal("undefined");
            });
            pm.test("document is shadowed", function() {
                pm.expect(typeof document).to.equal("undefined");
            });
            pm.test("fetch is shadowed", function() {
                pm.expect(typeof fetch).to.equal("undefined");
            });
            pm.test("localStorage is shadowed", function() {
                pm.expect(typeof localStorage).to.equal("undefined");
            });
        `);
        expect(result.success).toBe(true);
        expect(result.testResults.every(t => t.passed)).toBe(true);
    });

    it('provides pm.request data', async () => {
        const result = await executeScript(`
            console.log(pm.request.url);
            console.log(pm.request.method);
            console.log(pm.request.body);
        `, { request: REQUEST });
        expect(result.success).toBe(true);
        expect(result.consoleLogs[0]).toBe('https://api.test.com/users');
        expect(result.consoleLogs[1]).toBe('POST');
        expect(result.consoleLogs[2]).toBe('{"name":"Alice"}');
    });

    it('provides duration', async () => {
        const result = await executeScript('var x = 1 + 1;');
        expect(result.success).toBe(true);
        expect(typeof result.duration).toBe('number');
        expect(result.duration).toBeGreaterThanOrEqual(0);
    });

    it('getUpdatedEnvVars propagates changes', async () => {
        const result = await executeScript(
            'pm.environment.set("newToken", "refreshed123")',
            { environment: [{ key: 'existing', value: 'val', enabled: true }] }
        );
        expect(result.updatedEnvVars.existing).toBe('val');
        expect(result.updatedEnvVars.newToken).toBe('refreshed123');
    });

    it('getUpdatedVars propagates changes', async () => {
        const result = await executeScript(
            'pm.variables.set("chainVal", pm.response.json().id)',
            { response: RESPONSE, variables: {} }
        );
        expect(result.updatedVars.chainVal).toBe('1');
    });

    it('handles no params', async () => {
        const result = await executeScript('console.log("bare")');
        expect(result.success).toBe(true);
        expect(result.consoleLogs).toContain('bare');
    });
});

// ─── runPreRequestScript ─────────────────────────────────────────

describe('runPreRequestScript', () => {
    it('runs a pre-request script with variables', async () => {
        const result = await runPreRequestScript(
            'pm.variables.set("ts", String(Date.now()))',
            { variables: {}, environment: [], request: REQUEST }
        );
        expect(result.success).toBe(true);
        expect(result.updatedVars.ts).toBeDefined();
    });

    it('has no response in pre-request context', async () => {
        const result = await runPreRequestScript(
            'console.log(pm.response.status)',
            { variables: {}, environment: [], request: REQUEST }
        );
        expect(result.success).toBe(true);
        expect(result.consoleLogs[0]).toBe('0');
    });
});

// ─── runPostResponseScript ───────────────────────────────────────

describe('runPostResponseScript', () => {
    it('runs a post-response script with full context', async () => {
        const result = await runPostResponseScript(`
            pm.test("status ok", function() {
                pm.expect(pm.response.status).to.equal(200);
            });
            pm.environment.set("lastId", pm.response.json().id);
        `, {
            variables: {},
            environment: [],
            request: REQUEST,
            response: RESPONSE,
            responseTime: 150,
        });
        expect(result.success).toBe(true);
        expect(result.testResults[0].passed).toBe(true);
        expect(result.updatedEnvVars.lastId).toBe('1');
    });

    it('has access to response time', async () => {
        const result = await runPostResponseScript(
            'console.log(pm.response.responseTime)',
            { variables: {}, environment: [], request: REQUEST, response: RESPONSE, responseTime: 250 }
        );
        expect(result.consoleLogs[0]).toBe('250');
    });
});

// ─── Complex scripting scenarios ─────────────────────────────────

describe('complex scenarios', () => {
    it('chaining: extract token from response, set to env', async () => {
        const loginResponse = {
            status: 200,
            statusText: 'OK',
            data: { access_token: 'jwt.token.here', expires_in: 3600 },
            headers: {},
        };
        const result = await executeScript(`
            var data = pm.response.json();
            pm.environment.set("authToken", data.access_token);
            pm.environment.set("tokenExpiry", data.expires_in);
            pm.test("got token", function() {
                pm.expect(data.access_token).to.be.a("string");
            });
        `, { response: loginResponse, environment: [] });

        expect(result.success).toBe(true);
        expect(result.updatedEnvVars.authToken).toBe('jwt.token.here');
        expect(result.updatedEnvVars.tokenExpiry).toBe('3600');
        expect(result.testResults[0].passed).toBe(true);
    });

    it('multiple pm.test with mixed pass/fail', async () => {
        const result = await executeScript(`
            pm.test("pass 1", function() { pm.expect(1).to.equal(1); });
            pm.test("fail 1", function() { pm.expect(1).to.equal(2); });
            pm.test("pass 2", function() { pm.expect("hello").to.include("ell"); });
            pm.test("fail 2", function() { pm.expect([1]).to.have.lengthOf(5); });
        `);
        expect(result.success).toBe(true);
        expect(result.testResults).toHaveLength(4);
        expect(result.testResults[0].passed).toBe(true);
        expect(result.testResults[1].passed).toBe(false);
        expect(result.testResults[2].passed).toBe(true);
        expect(result.testResults[3].passed).toBe(false);
    });

    it('pm.expect().to.eql for deep object comparison', async () => {
        const result = await executeScript(`
            pm.test("deep equal", function() {
                pm.expect(pm.response.json()).to.eql({ id: 1, name: "Alice", roles: ["admin"] });
            });
        `, { response: RESPONSE });
        expect(result.testResults[0].passed).toBe(true);
    });

    it('pm.expect().to.have.property on response json', async () => {
        const result = await executeScript(`
            pm.test("has id", function() {
                pm.expect(pm.response.json()).to.have.property("id");
            });
            pm.test("no email", function() {
                pm.expect(pm.response.json()).to.have.property("email");
            });
        `, { response: RESPONSE });
        expect(result.testResults[0].passed).toBe(true);
        expect(result.testResults[1].passed).toBe(false);
    });

    it('reading existing env vars in script', async () => {
        const result = await executeScript(
            'console.log("url=" + pm.environment.get("baseUrl"))',
            { environment: ENV_VARS }
        );
        expect(result.consoleLogs[0]).toBe('url=https://api.test.com');
    });
});
