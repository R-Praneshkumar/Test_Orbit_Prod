import { describe, it, expect } from 'vitest';

describe('Test Framework Setup', () => {
    it('vitest works', () => {
        expect(1 + 1).toBe(2);
    });

    it('jsdom environment is available', () => {
        expect(typeof document).toBe('object');
        expect(typeof window).toBe('object');
    });

    it('jest-dom matchers are available', () => {
        const div = document.createElement('div');
        div.textContent = 'hello';
        document.body.appendChild(div);
        expect(div).toBeInTheDocument();
        document.body.removeChild(div);
    });
});
