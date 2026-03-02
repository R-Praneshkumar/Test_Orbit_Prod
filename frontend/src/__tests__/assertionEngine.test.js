import { describe, it, expect } from 'vitest';
import { evaluateAssertions, getAssertionLabel, createAssertion } from '../utils/assertionEngine';

// Helper: evaluate a single assertion and return the result
function evalOne(assertion, response, responseTime = 100) {
    const { results } = evaluateAssertions([{ id: 'test', enabled: true, ...assertion }], response, responseTime);
    return results[0];
}

// Standard response fixture
const RESPONSE = {
    status: 200,
    statusText: 'OK',
    data: { name: 'Alice', age: 30, tags: ['admin', 'user'], nested: { id: 1 } },
    headers: { 'Content-Type': 'application/json', 'X-Request-Id': 'abc-123' },
    success: true,
};

// ─── status_code assertions ──────────────────────────────────────

describe('status_code assertions', () => {
    it('equals — pass', () => {
        const r = evalOne({ type: 'status_code', comparison: 'equals', expected: '200' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('equals — fail', () => {
        const r = evalOne({ type: 'status_code', comparison: 'equals', expected: '404' }, RESPONSE);
        expect(r.passed).toBe(false);
        expect(r.message).toContain('404');
    });

    it('not_equals', () => {
        expect(evalOne({ type: 'status_code', comparison: 'not_equals', expected: '500' }, RESPONSE).passed).toBe(true);
        expect(evalOne({ type: 'status_code', comparison: 'not_equals', expected: '200' }, RESPONSE).passed).toBe(false);
    });

    it('greater_than', () => {
        expect(evalOne({ type: 'status_code', comparison: 'greater_than', expected: '199' }, RESPONSE).passed).toBe(true);
        expect(evalOne({ type: 'status_code', comparison: 'greater_than', expected: '200' }, RESPONSE).passed).toBe(false);
    });

    it('less_than', () => {
        expect(evalOne({ type: 'status_code', comparison: 'less_than', expected: '201' }, RESPONSE).passed).toBe(true);
        expect(evalOne({ type: 'status_code', comparison: 'less_than', expected: '200' }, RESPONSE).passed).toBe(false);
    });

    it('defaults to equals when comparison is omitted', () => {
        const r = evalOne({ type: 'status_code', expected: '200' }, RESPONSE);
        expect(r.passed).toBe(true);
    });
});

// ─── response_time assertions ────────────────────────────────────

describe('response_time assertions', () => {
    it('less_than — pass', () => {
        const r = evalOne({ type: 'response_time', comparison: 'less_than', expected: '500' }, RESPONSE, 120);
        expect(r.passed).toBe(true);
        expect(r.message).toContain('120ms');
    });

    it('less_than — fail', () => {
        const r = evalOne({ type: 'response_time', comparison: 'less_than', expected: '100' }, RESPONSE, 250);
        expect(r.passed).toBe(false);
    });

    it('greater_than', () => {
        expect(evalOne({ type: 'response_time', comparison: 'greater_than', expected: '50' }, RESPONSE, 120).passed).toBe(true);
    });

    it('defaults to less_than when comparison is omitted', () => {
        const r = evalOne({ type: 'response_time', expected: '500' }, RESPONSE, 120);
        expect(r.passed).toBe(true);
        expect(r.message).toContain('less_than');
    });

    it('handles zero response time', () => {
        const r = evalOne({ type: 'response_time', comparison: 'less_than', expected: '100' }, RESPONSE, 0);
        expect(r.passed).toBe(true);
    });

    it('handles undefined response time (defaults to 0)', () => {
        const assertion = { id: 't', type: 'response_time', comparison: 'equals', expected: '0', enabled: true };
        // Call evaluateAssertions directly — evalOne helper has a default param that masks undefined
        const { results } = evaluateAssertions([assertion], RESPONSE);
        expect(results[0].passed).toBe(true);
    });
});

// ─── body_contains assertions ────────────────────────────────────

describe('body_contains assertions', () => {
    it('finds string in JSON body', () => {
        const r = evalOne({ type: 'body_contains', expected: 'Alice' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('fails when string not in body', () => {
        const r = evalOne({ type: 'body_contains', expected: 'Zebra' }, RESPONSE);
        expect(r.passed).toBe(false);
    });

    it('works with string body', () => {
        const r = evalOne({ type: 'body_contains', expected: 'hello' }, { ...RESPONSE, data: 'hello world' });
        expect(r.passed).toBe(true);
    });

    it('handles empty expected', () => {
        const r = evalOne({ type: 'body_contains', expected: '' }, RESPONSE);
        expect(r.passed).toBe(true); // every string contains ''
    });

    it('handles null body', () => {
        const r = evalOne({ type: 'body_contains', expected: 'x' }, { ...RESPONSE, data: null });
        expect(r.passed).toBe(false);
    });
});

// ─── body_not_contains assertions ────────────────────────────────

describe('body_not_contains assertions', () => {
    it('passes when string not in body', () => {
        const r = evalOne({ type: 'body_not_contains', expected: 'Zebra' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('fails when string is in body', () => {
        const r = evalOne({ type: 'body_not_contains', expected: 'Alice' }, RESPONSE);
        expect(r.passed).toBe(false);
        expect(r.message).toContain('unexpectedly contains');
    });
});

// ─── json_path assertions ────────────────────────────────────────

describe('json_path assertions', () => {
    it('equals — top-level field', () => {
        const r = evalOne({ type: 'json_path', target: 'name', comparison: 'equals', expected: 'Alice' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('equals — fail', () => {
        const r = evalOne({ type: 'json_path', target: 'name', comparison: 'equals', expected: 'Bob' }, RESPONSE);
        expect(r.passed).toBe(false);
        expect(r.message).toContain('Bob');
    });

    it('nested path with dot notation', () => {
        const r = evalOne({ type: 'json_path', target: 'nested.id', comparison: 'equals', expected: '1' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('array index access', () => {
        const r = evalOne({ type: 'json_path', target: 'tags.0', comparison: 'equals', expected: 'admin' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('array index — second element', () => {
        const r = evalOne({ type: 'json_path', target: 'tags.1', comparison: 'equals', expected: 'user' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('exists — field present', () => {
        const r = evalOne({ type: 'json_path', target: 'name', comparison: 'exists' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('exists — field missing', () => {
        const r = evalOne({ type: 'json_path', target: 'nonexistent', comparison: 'exists' }, RESPONSE);
        expect(r.passed).toBe(false);
    });

    it('is_null — null value', () => {
        const resp = { ...RESPONSE, data: { value: null } };
        const r = evalOne({ type: 'json_path', target: 'value', comparison: 'is_null' }, resp);
        expect(r.passed).toBe(true);
    });

    it('is_not_null', () => {
        const r = evalOne({ type: 'json_path', target: 'name', comparison: 'is_not_null' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('is_type — string', () => {
        const r = evalOne({ type: 'json_path', target: 'name', comparison: 'is_type', expected: 'string' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('is_type — number', () => {
        const r = evalOne({ type: 'json_path', target: 'age', comparison: 'is_type', expected: 'number' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('is_type — array', () => {
        const r = evalOne({ type: 'json_path', target: 'tags', comparison: 'is_type', expected: 'array' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('is_type — object', () => {
        const r = evalOne({ type: 'json_path', target: 'nested', comparison: 'is_type', expected: 'object' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('is_type — object rejects array', () => {
        const r = evalOne({ type: 'json_path', target: 'tags', comparison: 'is_type', expected: 'object' }, RESPONSE);
        expect(r.passed).toBe(false);
    });

    it('contains', () => {
        const r = evalOne({ type: 'json_path', target: 'name', comparison: 'contains', expected: 'lic' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('not_contains', () => {
        const r = evalOne({ type: 'json_path', target: 'name', comparison: 'not_contains', expected: 'Bob' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('starts_with', () => {
        const r = evalOne({ type: 'json_path', target: 'name', comparison: 'starts_with', expected: 'Ali' }, RESPONSE);
        expect(r.passed).toBe(true);
        expect(evalOne({ type: 'json_path', target: 'name', comparison: 'starts_with', expected: 'Bob' }, RESPONSE).passed).toBe(false);
    });

    it('ends_with', () => {
        const r = evalOne({ type: 'json_path', target: 'name', comparison: 'ends_with', expected: 'ice' }, RESPONSE);
        expect(r.passed).toBe(true);
        expect(evalOne({ type: 'json_path', target: 'name', comparison: 'ends_with', expected: 'Bob' }, RESPONSE).passed).toBe(false);
    });

    it('matches_regex', () => {
        const r = evalOne({ type: 'json_path', target: 'name', comparison: 'matches_regex', expected: '^A.+e$' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('matches_regex — invalid regex returns false', () => {
        const r = evalOne({ type: 'json_path', target: 'name', comparison: 'matches_regex', expected: '[invalid(' }, RESPONSE);
        expect(r.passed).toBe(false);
    });

    it('greater_than_or_equal', () => {
        expect(evalOne({ type: 'json_path', target: 'age', comparison: 'greater_than_or_equal', expected: '30' }, RESPONSE).passed).toBe(true);
        expect(evalOne({ type: 'json_path', target: 'age', comparison: 'greater_than_or_equal', expected: '31' }, RESPONSE).passed).toBe(false);
    });

    it('less_than_or_equal', () => {
        expect(evalOne({ type: 'json_path', target: 'age', comparison: 'less_than_or_equal', expected: '30' }, RESPONSE).passed).toBe(true);
        expect(evalOne({ type: 'json_path', target: 'age', comparison: 'less_than_or_equal', expected: '29' }, RESPONSE).passed).toBe(false);
    });

    it('is_empty — empty string', () => {
        const resp = { ...RESPONSE, data: { value: '' } };
        expect(evalOne({ type: 'json_path', target: 'value', comparison: 'is_empty' }, resp).passed).toBe(true);
    });

    it('is_empty — empty array', () => {
        const resp = { ...RESPONSE, data: { value: [] } };
        expect(evalOne({ type: 'json_path', target: 'value', comparison: 'is_empty' }, resp).passed).toBe(true);
    });

    it('is_empty — empty object', () => {
        const resp = { ...RESPONSE, data: { value: {} } };
        expect(evalOne({ type: 'json_path', target: 'value', comparison: 'is_empty' }, resp).passed).toBe(true);
    });

    it('is_empty — null', () => {
        const resp = { ...RESPONSE, data: { value: null } };
        expect(evalOne({ type: 'json_path', target: 'value', comparison: 'is_empty' }, resp).passed).toBe(true);
    });

    it('is_empty — non-empty fails', () => {
        expect(evalOne({ type: 'json_path', target: 'name', comparison: 'is_empty' }, RESPONSE).passed).toBe(false);
    });

    it('is_not_empty — non-empty passes', () => {
        expect(evalOne({ type: 'json_path', target: 'name', comparison: 'is_not_empty' }, RESPONSE).passed).toBe(true);
    });

    it('is_not_empty — empty string fails', () => {
        const resp = { ...RESPONSE, data: { value: '' } };
        expect(evalOne({ type: 'json_path', target: 'value', comparison: 'is_not_empty' }, resp).passed).toBe(false);
    });

    it('length_equals — string', () => {
        expect(evalOne({ type: 'json_path', target: 'name', comparison: 'length_equals', expected: '5' }, RESPONSE).passed).toBe(true);
        expect(evalOne({ type: 'json_path', target: 'name', comparison: 'length_equals', expected: '3' }, RESPONSE).passed).toBe(false);
    });

    it('length_equals — array', () => {
        expect(evalOne({ type: 'json_path', target: 'tags', comparison: 'length_equals', expected: '2' }, RESPONSE).passed).toBe(true);
    });

    it('length_equals — null returns false', () => {
        const resp = { ...RESPONSE, data: { value: null } };
        expect(evalOne({ type: 'json_path', target: 'value', comparison: 'length_equals', expected: '0' }, resp).passed).toBe(false);
    });

    it('length_greater_than', () => {
        expect(evalOne({ type: 'json_path', target: 'tags', comparison: 'length_greater_than', expected: '1' }, RESPONSE).passed).toBe(true);
        expect(evalOne({ type: 'json_path', target: 'tags', comparison: 'length_greater_than', expected: '2' }, RESPONSE).passed).toBe(false);
    });

    it('length_less_than', () => {
        expect(evalOne({ type: 'json_path', target: 'tags', comparison: 'length_less_than', expected: '3' }, RESPONSE).passed).toBe(true);
        expect(evalOne({ type: 'json_path', target: 'tags', comparison: 'length_less_than', expected: '2' }, RESPONSE).passed).toBe(false);
    });

    it('handles string body (parses JSON)', () => {
        const resp = { ...RESPONSE, data: '{"key":"val"}' };
        const r = evalOne({ type: 'json_path', target: 'key', comparison: 'equals', expected: 'val' }, resp);
        expect(r.passed).toBe(true);
    });

    it('handles unparseable string body', () => {
        const resp = { ...RESPONSE, data: 'not json' };
        const r = evalOne({ type: 'json_path', target: 'key', comparison: 'exists' }, resp);
        expect(r.passed).toBe(false);
    });

    it('defaults to equals when comparison is omitted', () => {
        const r = evalOne({ type: 'json_path', target: 'name', expected: 'Alice' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('displays "undefined" for missing paths', () => {
        const r = evalOne({ type: 'json_path', target: 'missing.path', comparison: 'equals', expected: 'x' }, RESPONSE);
        expect(r.passed).toBe(false);
        expect(r.message).toContain('undefined');
    });

    it('unknown comparison returns false', () => {
        const r = evalOne({ type: 'json_path', target: 'name', comparison: 'unknown_op', expected: 'x' }, RESPONSE);
        expect(r.passed).toBe(false);
    });
});

// ─── header_contains assertions ──────────────────────────────────

describe('header_contains assertions', () => {
    it('case-insensitive header name match', () => {
        const r = evalOne({ type: 'header_contains', target: 'content-type', expected: 'json' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('case-insensitive — uppercase target', () => {
        const r = evalOne({ type: 'header_contains', target: 'CONTENT-TYPE', expected: 'json' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('partial match on value', () => {
        const r = evalOne({ type: 'header_contains', target: 'X-Request-Id', expected: 'abc' }, RESPONSE);
        expect(r.passed).toBe(true);
    });

    it('fails when header not found', () => {
        const r = evalOne({ type: 'header_contains', target: 'X-Missing', expected: 'anything' }, RESPONSE);
        expect(r.passed).toBe(false);
        expect(r.message).toContain('not found');
    });

    it('fails when header exists but value does not match', () => {
        const r = evalOne({ type: 'header_contains', target: 'Content-Type', expected: 'xml' }, RESPONSE);
        expect(r.passed).toBe(false);
    });

    it('handles empty headers object', () => {
        const r = evalOne({ type: 'header_contains', target: 'Content-Type', expected: 'json' }, { ...RESPONSE, headers: {} });
        expect(r.passed).toBe(false);
    });

    it('handles undefined headers', () => {
        const r = evalOne({ type: 'header_contains', target: 'Content-Type', expected: 'json' }, { ...RESPONSE, headers: undefined });
        expect(r.passed).toBe(false);
    });
});

// ─── body_json_schema assertions ─────────────────────────────────

describe('body_json_schema assertions', () => {
    it('valid object schema — pass', () => {
        const schema = JSON.stringify({ type: 'object', required: ['name', 'age'], properties: { name: { type: 'string' }, age: { type: 'number' } } });
        const r = evalOne({ type: 'body_json_schema', expected: schema }, RESPONSE);
        expect(r.passed).toBe(true);
        expect(r.message).toContain('matches');
    });

    it('fails on wrong type', () => {
        const schema = JSON.stringify({ type: 'array' });
        const r = evalOne({ type: 'body_json_schema', expected: schema }, RESPONSE);
        expect(r.passed).toBe(false);
        expect(r.message).toContain('expected type');
    });

    it('fails on missing required field', () => {
        const schema = JSON.stringify({ type: 'object', required: ['email'] });
        const r = evalOne({ type: 'body_json_schema', expected: schema }, RESPONSE);
        expect(r.passed).toBe(false);
        expect(r.message).toContain('email');
    });

    it('validates nested properties', () => {
        const schema = JSON.stringify({ type: 'object', properties: { nested: { type: 'object', properties: { id: { type: 'string' } } } } });
        const r = evalOne({ type: 'body_json_schema', expected: schema }, RESPONSE);
        expect(r.passed).toBe(false); // nested.id is number, not string
    });

    it('validates array items', () => {
        const resp = { ...RESPONSE, data: [1, 2, 3] };
        const schema = JSON.stringify({ type: 'array', items: { type: 'number' } });
        const r = evalOne({ type: 'body_json_schema', expected: schema }, resp);
        expect(r.passed).toBe(true);
    });

    it('fails on array items type mismatch', () => {
        const resp = { ...RESPONSE, data: [1, 'two', 3] };
        const schema = JSON.stringify({ type: 'array', items: { type: 'number' } });
        const r = evalOne({ type: 'body_json_schema', expected: schema }, resp);
        expect(r.passed).toBe(false);
    });

    it('validates enum', () => {
        const resp = { ...RESPONSE, data: 'active' };
        const schema = JSON.stringify({ enum: ['active', 'inactive'] });
        const r = evalOne({ type: 'body_json_schema', expected: schema }, resp);
        expect(r.passed).toBe(true);
    });

    it('fails on enum mismatch', () => {
        const resp = { ...RESPONSE, data: 'deleted' };
        const schema = JSON.stringify({ enum: ['active', 'inactive'] });
        const r = evalOne({ type: 'body_json_schema', expected: schema }, resp);
        expect(r.passed).toBe(false);
    });

    it('validates string minLength/maxLength', () => {
        const resp = { ...RESPONSE, data: 'hi' };
        expect(evalOne({ type: 'body_json_schema', expected: JSON.stringify({ type: 'string', minLength: 1 }) }, resp).passed).toBe(true);
        expect(evalOne({ type: 'body_json_schema', expected: JSON.stringify({ type: 'string', minLength: 5 }) }, resp).passed).toBe(false);
        expect(evalOne({ type: 'body_json_schema', expected: JSON.stringify({ type: 'string', maxLength: 10 }) }, resp).passed).toBe(true);
        expect(evalOne({ type: 'body_json_schema', expected: JSON.stringify({ type: 'string', maxLength: 1 }) }, resp).passed).toBe(false);
    });

    it('validates number minimum/maximum', () => {
        const resp = { ...RESPONSE, data: 5 };
        expect(evalOne({ type: 'body_json_schema', expected: JSON.stringify({ type: 'number', minimum: 1 }) }, resp).passed).toBe(true);
        expect(evalOne({ type: 'body_json_schema', expected: JSON.stringify({ type: 'number', minimum: 10 }) }, resp).passed).toBe(false);
        expect(evalOne({ type: 'body_json_schema', expected: JSON.stringify({ type: 'number', maximum: 10 }) }, resp).passed).toBe(true);
        expect(evalOne({ type: 'body_json_schema', expected: JSON.stringify({ type: 'number', maximum: 3 }) }, resp).passed).toBe(false);
    });

    it('validates boolean type', () => {
        const resp = { ...RESPONSE, data: true };
        expect(evalOne({ type: 'body_json_schema', expected: JSON.stringify({ type: 'boolean' }) }, resp).passed).toBe(true);
    });

    it('validates null type', () => {
        const resp = { ...RESPONSE, data: null };
        expect(evalOne({ type: 'body_json_schema', expected: JSON.stringify({ type: 'null' }) }, resp).passed).toBe(true);
    });

    it('validates integer type', () => {
        const resp = { ...RESPONSE, data: 42 };
        expect(evalOne({ type: 'body_json_schema', expected: JSON.stringify({ type: 'integer' }) }, resp).passed).toBe(true);
    });

    it('invalid JSON schema in expected — fails gracefully', () => {
        const r = evalOne({ type: 'body_json_schema', expected: 'not json' }, RESPONSE);
        expect(r.passed).toBe(false);
        expect(r.message).toContain('Invalid JSON schema');
    });

    it('handles string body (parses JSON)', () => {
        const resp = { ...RESPONSE, data: '{"count":5}' };
        const schema = JSON.stringify({ type: 'object', required: ['count'] });
        const r = evalOne({ type: 'body_json_schema', expected: schema }, resp);
        expect(r.passed).toBe(true);
    });

    it('handles empty/null schema', () => {
        const schema = JSON.stringify({});
        const r = evalOne({ type: 'body_json_schema', expected: schema }, RESPONSE);
        expect(r.passed).toBe(true); // empty schema matches anything
    });
});

// ─── unknown assertion type ──────────────────────────────────────

describe('unknown assertion type', () => {
    it('returns failure with descriptive message', () => {
        const r = evalOne({ type: 'nonexistent_type', expected: 'x' }, RESPONSE);
        expect(r.passed).toBe(false);
        expect(r.message).toContain('Unknown assertion type');
    });
});

// ─── evaluateAssertions (aggregation) ────────────────────────────

describe('evaluateAssertions', () => {
    it('returns empty results for empty array', () => {
        const result = evaluateAssertions([], RESPONSE, 100);
        expect(result).toEqual({ results: [], passed: 0, failed: 0, total: 0 });
    });

    it('returns empty results for null/undefined', () => {
        expect(evaluateAssertions(null, RESPONSE, 100)).toEqual({ results: [], passed: 0, failed: 0, total: 0 });
        expect(evaluateAssertions(undefined, RESPONSE, 100)).toEqual({ results: [], passed: 0, failed: 0, total: 0 });
    });

    it('skips disabled assertions', () => {
        const assertions = [
            { id: '1', type: 'status_code', comparison: 'equals', expected: '200', enabled: true },
            { id: '2', type: 'status_code', comparison: 'equals', expected: '404', enabled: false },
        ];
        const result = evaluateAssertions(assertions, RESPONSE, 100);
        expect(result.total).toBe(1);
        expect(result.passed).toBe(1);
        expect(result.failed).toBe(0);
    });

    it('counts passed and failed correctly', () => {
        const assertions = [
            { id: '1', type: 'status_code', comparison: 'equals', expected: '200', enabled: true },
            { id: '2', type: 'status_code', comparison: 'equals', expected: '404', enabled: true },
            { id: '3', type: 'body_contains', expected: 'Alice', enabled: true },
        ];
        const result = evaluateAssertions(assertions, RESPONSE, 100);
        expect(result.total).toBe(3);
        expect(result.passed).toBe(2);
        expect(result.failed).toBe(1);
    });

    it('includes id, name, type, passed, message in each result', () => {
        const assertions = [
            { id: 'a1', type: 'status_code', comparison: 'equals', expected: '200', enabled: true },
        ];
        const { results } = evaluateAssertions(assertions, RESPONSE, 100);
        expect(results[0]).toHaveProperty('id', 'a1');
        expect(results[0]).toHaveProperty('name');
        expect(results[0]).toHaveProperty('type', 'status_code');
        expect(results[0]).toHaveProperty('passed', true);
        expect(results[0]).toHaveProperty('message');
    });

    it('treats enabled=undefined as enabled (default true)', () => {
        const assertions = [
            { id: '1', type: 'status_code', comparison: 'equals', expected: '200' },
        ];
        const result = evaluateAssertions(assertions, RESPONSE, 100);
        expect(result.total).toBe(1);
    });
});

// ─── getAssertionLabel ───────────────────────────────────────────

describe('getAssertionLabel', () => {
    it('status_code label', () => {
        expect(getAssertionLabel({ type: 'status_code', comparison: 'equals', expected: '200' }))
            .toBe('Status equals 200');
    });

    it('status_code defaults comparison to equals', () => {
        expect(getAssertionLabel({ type: 'status_code', expected: '200' }))
            .toBe('Status equals 200');
    });

    it('response_time label', () => {
        expect(getAssertionLabel({ type: 'response_time', comparison: 'less_than', expected: '500' }))
            .toBe('Time less_than 500ms');
    });

    it('body_contains label', () => {
        expect(getAssertionLabel({ type: 'body_contains', expected: 'hello' }))
            .toBe('Body contains "hello"');
    });

    it('body_not_contains label', () => {
        expect(getAssertionLabel({ type: 'body_not_contains', expected: 'error' }))
            .toBe('Body doesn\'t contain "error"');
    });

    it('json_path label', () => {
        expect(getAssertionLabel({ type: 'json_path', target: 'data.id', comparison: 'equals', expected: '1' }))
            .toBe('$.data.id equals 1');
    });

    it('header_contains label', () => {
        expect(getAssertionLabel({ type: 'header_contains', target: 'Content-Type', expected: 'json' }))
            .toBe('Header Content-Type contains "json"');
    });

    it('body_json_schema label', () => {
        expect(getAssertionLabel({ type: 'body_json_schema' }))
            .toBe('Body matches JSON schema');
    });

    it('unknown type returns the type string', () => {
        expect(getAssertionLabel({ type: 'custom_thing' }))
            .toBe('custom_thing');
    });
});

// ─── createAssertion ─────────────────────────────────────────────

describe('createAssertion', () => {
    it('creates status_code by default', () => {
        const a = createAssertion();
        expect(a.type).toBe('status_code');
        expect(a.comparison).toBe('equals');
        expect(a.expected).toBe('200');
        expect(a.enabled).toBe(true);
        expect(a.id).toBeDefined();
    });

    it('creates response_time', () => {
        const a = createAssertion('response_time');
        expect(a.type).toBe('response_time');
        expect(a.comparison).toBe('less_than');
        expect(a.expected).toBe('2000');
    });

    it('creates body_contains', () => {
        const a = createAssertion('body_contains');
        expect(a.type).toBe('body_contains');
    });

    it('creates body_not_contains', () => {
        const a = createAssertion('body_not_contains');
        expect(a.type).toBe('body_not_contains');
    });

    it('creates json_path', () => {
        const a = createAssertion('json_path');
        expect(a.type).toBe('json_path');
        expect(a.comparison).toBe('equals');
    });

    it('creates header_contains', () => {
        const a = createAssertion('header_contains');
        expect(a.type).toBe('header_contains');
        expect(a.target).toBe('content-type');
        expect(a.expected).toBe('json');
    });

    it('creates body_json_schema', () => {
        const a = createAssertion('body_json_schema');
        expect(a.type).toBe('body_json_schema');
        expect(JSON.parse(a.expected)).toEqual({ type: 'object', required: [] });
    });

    it('unknown type falls back to status_code defaults', () => {
        const a = createAssertion('unknown_type');
        expect(a.type).toBe('unknown_type');
        expect(a.comparison).toBe('equals');
        expect(a.expected).toBe('200');
    });

    it('generates unique IDs', () => {
        const ids = new Set(Array.from({ length: 10 }, () => createAssertion().id));
        expect(ids.size).toBe(10);
    });
});

// ─── Edge cases & error handling ─────────────────────────────────

describe('edge cases', () => {
    it('deeply nested json_path', () => {
        const resp = { ...RESPONSE, data: { a: { b: { c: { d: 'deep' } } } } };
        const r = evalOne({ type: 'json_path', target: 'a.b.c.d', comparison: 'equals', expected: 'deep' }, resp);
        expect(r.passed).toBe(true);
    });

    it('json_path on empty object', () => {
        const resp = { ...RESPONSE, data: {} };
        const r = evalOne({ type: 'json_path', target: 'anything', comparison: 'exists' }, resp);
        expect(r.passed).toBe(false);
    });

    it('numeric string comparison with equals', () => {
        // compare() uses String() for equals, so 200 equals '200'
        const r = evalOne({ type: 'status_code', comparison: 'equals', expected: '200' }, { ...RESPONSE, status: 200 });
        expect(r.passed).toBe(true);
    });

    it('length_greater_than on null returns false', () => {
        const resp = { ...RESPONSE, data: { x: null } };
        expect(evalOne({ type: 'json_path', target: 'x', comparison: 'length_greater_than', expected: '0' }, resp).passed).toBe(false);
    });

    it('length_less_than on null returns false', () => {
        const resp = { ...RESPONSE, data: { x: null } };
        expect(evalOne({ type: 'json_path', target: 'x', comparison: 'length_less_than', expected: '5' }, resp).passed).toBe(false);
    });

    it('body_contains with object body serializes to JSON', () => {
        const resp = { ...RESPONSE, data: { key: 'value' } };
        const r = evalOne({ type: 'body_contains', expected: '"key":"value"' }, resp);
        expect(r.passed).toBe(true);
    });

    it('schema with multiple errors shows up to 3', () => {
        const resp = { ...RESPONSE, data: { a: 1, b: 2, c: 3, d: 4 } };
        const schema = JSON.stringify({
            type: 'object',
            properties: {
                a: { type: 'string' },
                b: { type: 'string' },
                c: { type: 'string' },
                d: { type: 'string' },
            }
        });
        const r = evalOne({ type: 'body_json_schema', expected: schema }, resp);
        expect(r.passed).toBe(false);
        // Message should contain at most 3 errors joined by '; '
        const errorCount = r.message.split('; ').length;
        expect(errorCount).toBeLessThanOrEqual(4); // "Schema validation failed: " + up to 3 errors
    });
});
