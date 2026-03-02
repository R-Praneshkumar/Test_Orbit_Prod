import { describe, it, expect } from 'vitest';
import { compareToSchema, getResponseSchema, runLocalContractChecks } from '../utils/contractEngine';

// ─── compareToSchema ────────────────────────────────────────────────

describe('compareToSchema', () => {

    // ── null / empty schema ──────────────────────────────────────────

    describe('edge cases', () => {
        it('returns passed when schema is null', () => {
            const { drifts, passed } = compareToSchema({ a: 1 }, null);
            expect(passed).toBe(true);
            expect(drifts).toHaveLength(0);
        });

        it('returns passed when schema is undefined', () => {
            const { drifts, passed } = compareToSchema('hello', undefined);
            expect(passed).toBe(true);
            expect(drifts).toHaveLength(0);
        });

        it('returns passed for empty schema object', () => {
            const { passed } = compareToSchema({ foo: 1 }, {});
            expect(passed).toBe(true);
        });
    });

    // ── type checking ────────────────────────────────────────────────

    describe('type checking', () => {
        it('passes when string matches string type', () => {
            const { passed } = compareToSchema('hello', { type: 'string' });
            expect(passed).toBe(true);
        });

        it('fails when number given but string expected', () => {
            const { passed, drifts } = compareToSchema(42, { type: 'string' });
            expect(passed).toBe(false);
            expect(drifts).toHaveLength(1);
            expect(drifts[0].issue).toBe('type_mismatch');
            expect(drifts[0].specType).toBe('string');
            expect(drifts[0].actualType).toBe('number');
            expect(drifts[0].severity).toBe('error');
        });

        it('passes when number matches number type', () => {
            const { passed } = compareToSchema(3.14, { type: 'number' });
            expect(passed).toBe(true);
        });

        it('passes when integer matches integer type', () => {
            const { passed } = compareToSchema(42, { type: 'integer' });
            expect(passed).toBe(true);
        });

        it('fails when float given but integer expected', () => {
            const { passed, drifts } = compareToSchema(3.14, { type: 'integer' });
            expect(passed).toBe(false);
            expect(drifts[0].issue).toBe('type_mismatch');
        });

        it('integer also counts as number', () => {
            const { passed } = compareToSchema(42, { type: 'number' });
            expect(passed).toBe(true);
        });

        it('passes when boolean matches boolean type', () => {
            const { passed } = compareToSchema(true, { type: 'boolean' });
            expect(passed).toBe(true);
        });

        it('fails when string given but boolean expected', () => {
            const { passed } = compareToSchema('true', { type: 'boolean' });
            expect(passed).toBe(false);
        });

        it('passes when array matches array type', () => {
            const { passed } = compareToSchema([1, 2], { type: 'array' });
            expect(passed).toBe(true);
        });

        it('fails when object given but array expected', () => {
            const { passed } = compareToSchema({}, { type: 'array' });
            expect(passed).toBe(false);
        });

        it('passes when object matches object type', () => {
            const { passed } = compareToSchema({ a: 1 }, { type: 'object' });
            expect(passed).toBe(true);
        });

        it('skips type check when data is null', () => {
            const { passed } = compareToSchema(null, { type: 'string' });
            expect(passed).toBe(true);
        });

        it('skips type check when data is undefined', () => {
            const { passed } = compareToSchema(undefined, { type: 'number' });
            expect(passed).toBe(true);
        });
    });

    // ── enum validation ──────────────────────────────────────────────

    describe('enum validation', () => {
        it('passes when value is in enum list', () => {
            const schema = { type: 'string', enum: ['active', 'inactive', 'pending'] };
            const { passed } = compareToSchema('active', schema);
            expect(passed).toBe(true);
        });

        it('fails when value is not in enum list', () => {
            const schema = { type: 'string', enum: ['active', 'inactive'] };
            const { passed, drifts } = compareToSchema('deleted', schema);
            expect(passed).toBe(false);
            expect(drifts[0].issue).toBe('invalid_enum');
            expect(drifts[0].message).toContain('deleted');
            expect(drifts[0].message).toContain('active');
        });

        it('skips enum check when data is null', () => {
            const schema = { enum: ['a', 'b'] };
            const { passed } = compareToSchema(null, schema);
            expect(passed).toBe(true);
        });

        it('works with numeric enums', () => {
            const schema = { type: 'number', enum: [1, 2, 3] };
            expect(compareToSchema(2, schema).passed).toBe(true);
            expect(compareToSchema(5, schema).passed).toBe(false);
        });
    });

    // ── object: required fields ──────────────────────────────────────

    describe('required fields', () => {
        const schema = {
            type: 'object',
            properties: {
                id: { type: 'integer' },
                name: { type: 'string' },
                email: { type: 'string' },
            },
            required: ['id', 'name'],
        };

        it('passes when all required fields are present', () => {
            const { passed } = compareToSchema({ id: 1, name: 'Alice' }, schema);
            expect(passed).toBe(true);
        });

        it('passes with extra optional fields present', () => {
            const { passed } = compareToSchema({ id: 1, name: 'Alice', email: 'a@b.com' }, schema);
            expect(passed).toBe(true);
        });

        it('fails when a required field is missing', () => {
            const { passed, drifts } = compareToSchema({ id: 1 }, schema);
            expect(passed).toBe(false);
            const missing = drifts.find(d => d.issue === 'missing_required');
            expect(missing).toBeDefined();
            expect(missing.field).toBe('name');
            expect(missing.actualType).toBe('(missing)');
        });

        it('fails when multiple required fields are missing', () => {
            const { drifts } = compareToSchema({}, schema);
            const missingFields = drifts.filter(d => d.issue === 'missing_required').map(d => d.field);
            expect(missingFields).toContain('id');
            expect(missingFields).toContain('name');
        });

        it('reports correct specType for missing fields', () => {
            const { drifts } = compareToSchema({}, schema);
            const idDrift = drifts.find(d => d.field === 'id');
            expect(idDrift.specType).toBe('integer');
        });
    });

    // ── object: nested property type checking ────────────────────────

    describe('nested property types', () => {
        const schema = {
            type: 'object',
            properties: {
                user: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' },
                        age: { type: 'integer' },
                    },
                    required: ['name'],
                },
            },
        };

        it('passes with valid nested data', () => {
            const { passed } = compareToSchema({ user: { name: 'Bob', age: 25 } }, schema);
            expect(passed).toBe(true);
        });

        it('detects type mismatch in nested property', () => {
            const { passed, drifts } = compareToSchema({ user: { name: 'Bob', age: 'twenty' } }, schema);
            expect(passed).toBe(false);
            expect(drifts[0].field).toBe('user.age');
            expect(drifts[0].issue).toBe('type_mismatch');
        });

        it('detects missing required field in nested object', () => {
            const { passed, drifts } = compareToSchema({ user: { age: 25 } }, schema);
            expect(passed).toBe(false);
            expect(drifts[0].field).toBe('user.name');
            expect(drifts[0].issue).toBe('missing_required');
        });

        it('skips checking properties not present in data', () => {
            // 'user' key is absent — no properties to recurse into, no required at root
            const { passed } = compareToSchema({}, schema);
            expect(passed).toBe(true);
        });
    });

    // ── object: additionalProperties ─────────────────────────────────

    describe('additionalProperties', () => {
        const schema = {
            type: 'object',
            properties: { id: { type: 'integer' } },
            additionalProperties: false,
        };

        it('passes when no extra fields', () => {
            const { passed } = compareToSchema({ id: 1 }, schema);
            expect(passed).toBe(true);
        });

        it('warns about extra fields not in spec', () => {
            const { passed, drifts } = compareToSchema({ id: 1, secret: 'x' }, schema);
            // extra_field is a warning, not error — so passed is still true
            expect(passed).toBe(true);
            expect(drifts).toHaveLength(1);
            expect(drifts[0].issue).toBe('extra_field');
            expect(drifts[0].severity).toBe('warning');
            expect(drifts[0].field).toBe('secret');
        });

        it('does not warn about extra fields when additionalProperties is not false', () => {
            const openSchema = { type: 'object', properties: { id: { type: 'integer' } } };
            const { drifts } = compareToSchema({ id: 1, extra: 'ok' }, openSchema);
            expect(drifts).toHaveLength(0);
        });

        it('reports multiple extra fields', () => {
            const { drifts } = compareToSchema({ id: 1, foo: 'a', bar: 'b' }, schema);
            const extras = drifts.filter(d => d.issue === 'extra_field');
            expect(extras).toHaveLength(2);
        });
    });

    // ── array items ──────────────────────────────────────────────────

    describe('array items', () => {
        const schema = {
            type: 'array',
            items: { type: 'string' },
        };

        it('passes when all items match type', () => {
            const { passed } = compareToSchema(['a', 'b', 'c'], schema);
            expect(passed).toBe(true);
        });

        it('detects type mismatch in array item', () => {
            const { passed, drifts } = compareToSchema(['a', 42, 'c'], schema);
            expect(passed).toBe(false);
            expect(drifts[0].field).toBe('[1]');
            expect(drifts[0].issue).toBe('type_mismatch');
        });

        it('checks at most 3 items', () => {
            // 5 bad items, but only first 3 should be checked
            const { drifts } = compareToSchema([1, 2, 3, 4, 5], schema);
            expect(drifts).toHaveLength(3);
        });

        it('passes for empty array', () => {
            const { passed } = compareToSchema([], schema);
            expect(passed).toBe(true);
        });

        it('checks array of objects', () => {
            const objectArraySchema = {
                type: 'array',
                items: {
                    type: 'object',
                    properties: { name: { type: 'string' } },
                    required: ['name'],
                },
            };
            const { passed } = compareToSchema([{ name: 'Alice' }, { name: 'Bob' }], objectArraySchema);
            expect(passed).toBe(true);

            const { passed: p2, drifts } = compareToSchema([{ name: 'Alice' }, {}], objectArraySchema);
            expect(p2).toBe(false);
            expect(drifts[0].field).toBe('[1].name');
        });
    });

    // ── $ref resolution ──────────────────────────────────────────────

    describe('$ref resolution', () => {
        const spec = {
            components: {
                schemas: {
                    User: {
                        type: 'object',
                        properties: {
                            id: { type: 'integer' },
                            name: { type: 'string' },
                        },
                        required: ['id', 'name'],
                    },
                },
            },
        };

        it('resolves $ref and validates data', () => {
            const schema = { $ref: '#/components/schemas/User' };
            const { passed } = compareToSchema({ id: 1, name: 'Alice' }, schema, spec);
            expect(passed).toBe(true);
        });

        it('resolves $ref and detects missing required field', () => {
            const schema = { $ref: '#/components/schemas/User' };
            const { passed, drifts } = compareToSchema({ id: 1 }, schema, spec);
            expect(passed).toBe(false);
            expect(drifts[0].issue).toBe('missing_required');
        });

        it('passes when $ref cannot be resolved (skips)', () => {
            const schema = { $ref: '#/components/schemas/NonExistent' };
            const { passed } = compareToSchema({ anything: true }, schema, spec);
            expect(passed).toBe(true);
        });

        it('passes when $ref exists but specRoot is null', () => {
            const schema = { $ref: '#/components/schemas/User' };
            const { passed } = compareToSchema({ id: 1 }, schema, null);
            expect(passed).toBe(true);
        });

        it('resolves nested $ref in array items', () => {
            const schema = { type: 'array', items: { $ref: '#/components/schemas/User' } };
            const { passed } = compareToSchema([{ id: 1, name: 'A' }], schema, spec);
            expect(passed).toBe(true);

            const { passed: p2 } = compareToSchema([{ id: 'bad' }], schema, spec);
            expect(p2).toBe(false);
        });
    });

    // ── allOf ────────────────────────────────────────────────────────

    describe('allOf', () => {
        it('merges all sub-schemas and validates', () => {
            const schema = {
                allOf: [
                    { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
                    { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
                ],
            };
            const { passed } = compareToSchema({ id: 1, name: 'Alice' }, schema);
            expect(passed).toBe(true);
        });

        it('fails if any sub-schema requirement is not met', () => {
            const schema = {
                allOf: [
                    { type: 'object', properties: { id: { type: 'integer' } }, required: ['id'] },
                    { type: 'object', properties: { name: { type: 'string' } }, required: ['name'] },
                ],
            };
            const { passed, drifts } = compareToSchema({ id: 1 }, schema);
            expect(passed).toBe(false);
            expect(drifts.some(d => d.issue === 'missing_required' && d.field === 'name')).toBe(true);
        });

        it('collects drifts from all sub-schemas', () => {
            const schema = {
                allOf: [
                    { type: 'object', properties: { a: { type: 'integer' } }, required: ['a'] },
                    { type: 'object', properties: { b: { type: 'string' } }, required: ['b'] },
                ],
            };
            const { drifts } = compareToSchema({}, schema);
            expect(drifts.filter(d => d.issue === 'missing_required')).toHaveLength(2);
        });
    });

    // ── oneOf / anyOf ────────────────────────────────────────────────

    describe('oneOf / anyOf', () => {
        it('passes oneOf when data matches one schema', () => {
            const schema = {
                oneOf: [
                    { type: 'string' },
                    { type: 'integer' },
                ],
            };
            expect(compareToSchema('hello', schema).passed).toBe(true);
            expect(compareToSchema(42, schema).passed).toBe(true);
        });

        it('fails oneOf when data matches no schema', () => {
            const schema = {
                oneOf: [
                    { type: 'string' },
                    { type: 'integer' },
                ],
            };
            const { passed } = compareToSchema(true, schema);
            expect(passed).toBe(false);
        });

        it('returns best (fewest errors) drift set on failure', () => {
            const schema = {
                oneOf: [
                    { type: 'object', properties: { a: { type: 'string' } }, required: ['a'] },
                    { type: 'object', properties: { a: { type: 'string' }, b: { type: 'string' } }, required: ['a', 'b'] },
                ],
            };
            // Data {} fails both, but first schema has 1 missing, second has 2 missing
            const { drifts } = compareToSchema({}, schema);
            // Best match should be the first (only 1 missing_required)
            expect(drifts.filter(d => d.severity === 'error').length).toBeLessThanOrEqual(1);
        });

        it('passes anyOf when data matches one schema', () => {
            const schema = {
                anyOf: [
                    { type: 'string' },
                    { type: 'number' },
                ],
            };
            expect(compareToSchema(3.14, schema).passed).toBe(true);
        });

        it('fails anyOf when data matches no schema', () => {
            const schema = {
                anyOf: [
                    { type: 'string' },
                    { type: 'number' },
                ],
            };
            expect(compareToSchema([], schema).passed).toBe(false);
        });
    });

    // ── path reporting ───────────────────────────────────────────────

    describe('path reporting', () => {
        it('uses (root) when no path is given', () => {
            const { drifts } = compareToSchema(42, { type: 'string' });
            expect(drifts[0].field).toBe('(root)');
        });

        it('uses custom path when provided', () => {
            const { drifts } = compareToSchema(42, { type: 'string' }, null, 'data.value');
            expect(drifts[0].field).toBe('data.value');
        });

        it('builds nested paths for object properties', () => {
            const schema = {
                type: 'object',
                properties: {
                    user: {
                        type: 'object',
                        properties: { score: { type: 'number' } },
                    },
                },
            };
            const { drifts } = compareToSchema({ user: { score: 'bad' } }, schema);
            expect(drifts[0].field).toBe('user.score');
        });

        it('builds indexed paths for array items', () => {
            const schema = { type: 'array', items: { type: 'number' } };
            const { drifts } = compareToSchema([1, 'bad'], schema);
            expect(drifts[0].field).toBe('[1]');
        });
    });

    // ── properties without explicit type ─────────────────────────────

    describe('object schema without explicit type', () => {
        it('treats schema with properties as object even without type:object', () => {
            const schema = {
                properties: { id: { type: 'integer' } },
                required: ['id'],
            };
            const { passed, drifts } = compareToSchema({}, schema);
            expect(passed).toBe(false);
            expect(drifts[0].issue).toBe('missing_required');
        });
    });

    // ── drift message content ────────────────────────────────────────

    describe('drift messages', () => {
        it('type_mismatch message includes expected and actual types', () => {
            const { drifts } = compareToSchema([], { type: 'string' });
            expect(drifts[0].message).toContain('string');
            expect(drifts[0].message).toContain('array');
        });

        it('missing_required message includes field name', () => {
            const schema = { type: 'object', properties: { email: { type: 'string' } }, required: ['email'] };
            const { drifts } = compareToSchema({}, schema);
            expect(drifts[0].message).toContain('email');
        });

        it('extra_field message includes field name', () => {
            const schema = { type: 'object', properties: {}, additionalProperties: false };
            const { drifts } = compareToSchema({ surprise: 1 }, schema);
            expect(drifts[0].message).toContain('surprise');
        });
    });
});

// ─── getResponseSchema ──────────────────────────────────────────────

describe('getResponseSchema', () => {
    const spec = {
        paths: {
            '/users': {
                get: {
                    responses: {
                        '200': {
                            content: { 'application/json': { schema: { type: 'array', items: { type: 'object' } } } },
                        },
                        '404': {
                            content: { 'application/json': { schema: { type: 'object', properties: { error: { type: 'string' } } } } },
                        },
                    },
                },
                post: {
                    responses: {
                        '201': {
                            content: { 'application/json': { schema: { type: 'object' } } },
                        },
                    },
                },
            },
            '/health': {
                get: {
                    responses: {
                        '2xx': {
                            content: { 'application/json': { schema: { type: 'object', properties: { ok: { type: 'boolean' } } } } },
                        },
                    },
                },
            },
            '/fallback': {
                get: {
                    responses: {
                        'default': {
                            content: { 'application/json': { schema: { type: 'string' } } },
                        },
                    },
                },
            },
            '/no-json': {
                get: {
                    responses: {
                        '200': {
                            content: { 'text/plain': { schema: { type: 'string' } } },
                        },
                    },
                },
            },
        },
    };

    it('returns schema for exact status code match', () => {
        const schema = getResponseSchema(spec, 'GET', '/users', '200');
        expect(schema).toEqual({ type: 'array', items: { type: 'object' } });
    });

    it('returns schema for different status code', () => {
        const schema = getResponseSchema(spec, 'GET', '/users', '404');
        expect(schema.properties.error.type).toBe('string');
    });

    it('returns schema for POST method', () => {
        const schema = getResponseSchema(spec, 'POST', '/users', '201');
        expect(schema).toEqual({ type: 'object' });
    });

    it('falls back to 2xx wildcard', () => {
        const schema = getResponseSchema(spec, 'GET', '/health', '200');
        expect(schema.properties.ok.type).toBe('boolean');
    });

    it('falls back to default response', () => {
        const schema = getResponseSchema(spec, 'GET', '/fallback', '200');
        expect(schema).toEqual({ type: 'string' });
    });

    it('returns null when path does not exist', () => {
        expect(getResponseSchema(spec, 'GET', '/nope')).toBeNull();
    });

    it('returns null when method does not exist on path', () => {
        expect(getResponseSchema(spec, 'DELETE', '/users')).toBeNull();
    });

    it('returns null when no matching status code', () => {
        expect(getResponseSchema(spec, 'POST', '/users', '200')).toBeNull();
    });

    it('returns null when no application/json content', () => {
        expect(getResponseSchema(spec, 'GET', '/no-json', '200')).toBeNull();
    });

    it('returns null when spec is null', () => {
        expect(getResponseSchema(null, 'GET', '/users')).toBeNull();
    });

    it('is case-insensitive on method', () => {
        const schema = getResponseSchema(spec, 'get', '/users', '200');
        expect(schema).toBeTruthy();
        const schema2 = getResponseSchema(spec, 'GET', '/users', '200');
        expect(schema2).toBeTruthy();
    });

    it('defaults to status 200', () => {
        const schema = getResponseSchema(spec, 'GET', '/users');
        expect(schema).toEqual({ type: 'array', items: { type: 'object' } });
    });
});

// ─── runLocalContractChecks ─────────────────────────────────────────

describe('runLocalContractChecks', () => {
    const spec = {
        paths: {
            '/users': {
                get: {
                    responses: {
                        '200': {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                id: { type: 'integer' },
                                                name: { type: 'string' },
                                            },
                                            required: ['id', 'name'],
                                        },
                                    },
                                },
                            },
                        },
                    },
                },
                post: {
                    responses: {
                        '200': {
                            content: {
                                'application/json': {
                                    schema: {
                                        type: 'object',
                                        properties: { id: { type: 'integer' } },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            '/health': {
                get: {
                    responses: {
                        '200': {
                            content: {
                                'application/json': {
                                    schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
                                },
                            },
                        },
                    },
                },
            },
        },
    };

    it('returns empty array when spec has no paths', () => {
        expect(runLocalContractChecks({}, {}, [])).toEqual([]);
        expect(runLocalContractChecks(null, {}, [])).toEqual([]);
    });

    it('marks endpoints as skipped when no cached response', () => {
        const results = runLocalContractChecks(spec, {}, [], 'https://api.example.com');
        expect(results.length).toBeGreaterThan(0);
        results.forEach(r => {
            expect(r.status).toBe('skipped');
            expect(r.message).toContain('No cached response');
        });
    });

    it('validates matching request with pass result', () => {
        const requests = [{ id: 'r1', method: 'GET', url: 'https://api.example.com/users' }];
        const cached = {
            r1: { data: [{ id: 1, name: 'Alice' }], status: 200, time: 50 },
        };
        const results = runLocalContractChecks(spec, cached, requests, 'https://api.example.com');
        const usersGet = results.find(r => r.path === '/users' && r.method === 'GET');
        expect(usersGet.status).toBe('pass');
        expect(usersGet.driftCount).toBe(0);
        expect(usersGet.actualStatus).toBe(200);
        expect(usersGet.responseTime).toBe(50);
    });

    it('detects drift in response data', () => {
        const requests = [{ id: 'r1', method: 'GET', url: 'https://api.example.com/users' }];
        const cached = {
            r1: { data: [{ id: 'not-an-int', name: 'Alice' }], status: 200 },
        };
        const results = runLocalContractChecks(spec, cached, requests, 'https://api.example.com');
        const usersGet = results.find(r => r.path === '/users' && r.method === 'GET');
        expect(usersGet.status).toBe('drift');
        expect(usersGet.driftCount).toBeGreaterThan(0);
    });

    it('matches requests by URL ending with path', () => {
        const requests = [{ id: 'r1', method: 'GET', url: 'http://localhost:3000/api/v1/users' }];
        const cached = {
            r1: { data: [{ id: 1, name: 'Bob' }], status: 200 },
        };
        const results = runLocalContractChecks(spec, cached, requests, 'http://localhost:3000/api/v1');
        const usersGet = results.find(r => r.path === '/users' && r.method === 'GET');
        expect(usersGet.status).toBe('pass');
    });

    it('defaults missing method to GET', () => {
        const requests = [{ id: 'r1', url: 'https://api.example.com/health' }];
        const cached = {
            r1: { data: { ok: true }, status: 200 },
        };
        const results = runLocalContractChecks(spec, cached, requests, 'https://api.example.com');
        const healthGet = results.find(r => r.path === '/health' && r.method === 'GET');
        expect(healthGet.status).toBe('pass');
    });

    it('parses JSON string response data', () => {
        const requests = [{ id: 'r1', method: 'GET', url: 'https://api.example.com/health' }];
        const cached = {
            r1: { data: '{"ok": true}', status: 200 },
        };
        const results = runLocalContractChecks(spec, cached, requests, 'https://api.example.com');
        const healthGet = results.find(r => r.path === '/health' && r.method === 'GET');
        expect(healthGet.status).toBe('pass');
    });

    it('handles non-JSON string gracefully', () => {
        const requests = [{ id: 'r1', method: 'GET', url: 'https://api.example.com/health' }];
        const cached = {
            r1: { data: 'not json', status: 200 },
        };
        const results = runLocalContractChecks(spec, cached, requests, 'https://api.example.com');
        const healthGet = results.find(r => r.path === '/health' && r.method === 'GET');
        // String data vs object schema = type mismatch
        expect(healthGet.status).toBe('drift');
    });

    it('strips trailing slash from baseUrl', () => {
        const requests = [{ id: 'r1', method: 'GET', url: 'https://api.example.com/health' }];
        const cached = {
            r1: { data: { ok: true }, status: 200 },
        };
        const results = runLocalContractChecks(spec, cached, requests, 'https://api.example.com/');
        const healthGet = results.find(r => r.path === '/health' && r.method === 'GET');
        expect(healthGet.status).toBe('pass');
    });

    it('handles POST endpoints', () => {
        const requests = [{ id: 'r2', method: 'POST', url: 'https://api.example.com/users' }];
        const cached = {
            r2: { data: { id: 42 }, status: 201 },
        };
        const results = runLocalContractChecks(spec, cached, requests, 'https://api.example.com');
        const usersPost = results.find(r => r.path === '/users' && r.method === 'POST');
        expect(usersPost.status).toBe('pass');
    });

    it('defaults responseTime to 0 when not provided', () => {
        const requests = [{ id: 'r1', method: 'GET', url: 'https://api.example.com/health' }];
        const cached = {
            r1: { data: { ok: true }, status: 200 },
        };
        const results = runLocalContractChecks(spec, cached, requests, 'https://api.example.com');
        const healthGet = results.find(r => r.path === '/health' && r.method === 'GET');
        expect(healthGet.responseTime).toBe(0);
    });

    it('includes fullUrl in results', () => {
        const results = runLocalContractChecks(spec, {}, [], 'https://api.example.com');
        const usersGet = results.find(r => r.path === '/users' && r.method === 'GET');
        expect(usersGet.fullUrl).toBe('https://api.example.com/users');
    });
});
