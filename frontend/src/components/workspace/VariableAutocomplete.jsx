import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Variable, Globe, Link2, Zap } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

const DYNAMIC_VARS = [
    { key: '$timestamp', desc: 'Unix timestamp (ms)', category: 'dynamic' },
    { key: '$isoTimestamp', desc: 'ISO 8601 date', category: 'dynamic' },
    { key: '$randomInt', desc: 'Random integer 0-999', category: 'dynamic' },
    { key: '$guid', desc: 'Random UUID', category: 'dynamic' },
    { key: '$randomEmail', desc: 'Random test email', category: 'dynamic' },
    { key: '$randomName', desc: 'Random name', category: 'dynamic' },
    { key: '$randomPhone', desc: 'Random phone number', category: 'dynamic' },
    { key: '$randomBoolean', desc: 'true or false', category: 'dynamic' },
];

const CATEGORY_ICON = {
    env: Globe,
    chain: Link2,
    dynamic: Zap,
};

const CATEGORY_COLOR = {
    env: 'text-emerald-500',
    chain: 'text-amber-500',
    dynamic: 'text-purple-500',
};

/**
 * Builds a flat list of all available variables from env, chain vars, and dynamic vars.
 */
function useAvailableVariables() {
    const environments = useWorkspaceStore(state => state.environments);
    const activeEnv = useWorkspaceStore(state => state.activeEnv);
    const chainVars = useWorkspaceStore(state => state.chainVars);

    return useMemo(() => {
        const vars = [];
        const seen = new Set();

        // Environment variables (Global + active)
        const globalEnv = environments.find(e => e.name === 'Global');
        const activeEnvObj = environments.find(e => e.name === activeEnv);
        const envVars = [...(globalEnv?.vars || [])];
        if (activeEnvObj && activeEnvObj.name !== 'Global') {
            envVars.push(...(activeEnvObj.vars || []));
        }
        for (const v of envVars) {
            if (v.enabled !== false && v.key && !seen.has(v.key)) {
                seen.add(v.key);
                vars.push({ key: v.key, desc: v.value || '', category: 'env' });
            }
        }

        // Chain variables
        for (const [k, v] of Object.entries(chainVars || {})) {
            if (!seen.has(k)) {
                seen.add(k);
                vars.push({ key: k, desc: String(v || ''), category: 'chain' });
            }
        }

        // Dynamic variables
        for (const dv of DYNAMIC_VARS) {
            if (!seen.has(dv.key)) {
                vars.push(dv);
            }
        }

        return vars;
    }, [environments, activeEnv, chainVars]);
}

/**
 * Autocomplete dropdown for variable insertion.
 * Renders an absolutely-positioned dropdown below/above the anchor element.
 */
function AutocompleteDropdown({ items, selectedIndex, onSelect, position }) {
    const listRef = useRef(null);

    useEffect(() => {
        if (!listRef.current) return;
        const el = listRef.current.children[selectedIndex];
        if (el) el.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    if (items.length === 0) return null;

    return (
        <div
            ref={listRef}
            className="absolute z-50 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-y-auto max-h-48 min-w-[220px] py-1"
            style={{ left: position.left, top: position.top }}
        >
            {items.map((item, idx) => {
                const Icon = CATEGORY_ICON[item.category] || Variable;
                const color = CATEGORY_COLOR[item.category] || 'text-slate-400';
                return (
                    <button
                        key={item.key}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                            idx === selectedIndex
                                ? 'bg-corporate-50 dark:bg-corporate-900/30'
                                : 'hover:bg-slate-50 dark:hover:bg-slate-800'
                        }`}
                        onMouseDown={(e) => {
                            e.preventDefault(); // Prevent input blur
                            onSelect(item);
                        }}
                        onMouseEnter={() => {}} // handled by parent
                    >
                        <Icon size={12} className={`shrink-0 ${color}`} />
                        <span className="text-xs font-mono font-medium text-slate-700 dark:text-slate-200 truncate">{item.key}</span>
                        <span className="text-[10px] text-slate-400 dark:text-slate-500 truncate ml-auto">{item.desc?.slice(0, 30)}</span>
                    </button>
                );
            })}
        </div>
    );
}

/**
 * Hook that manages variable autocomplete state for an input/textarea.
 * Returns props to spread on the element + the dropdown JSX to render.
 */
function useVariableAutocomplete({ value, onChange, inputRef }) {
    const allVars = useAvailableVariables();
    const [showDropdown, setShowDropdown] = useState(false);
    const [filter, setFilter] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [triggerPos, setTriggerPos] = useState(null); // cursor position of `{{`
    const [dropdownPos, setDropdownPos] = useState({ left: 0, top: 0 });

    const filtered = useMemo(() => {
        if (!filter) return allVars.slice(0, 15);
        const q = filter.toLowerCase();
        return allVars.filter(v => v.key.toLowerCase().includes(q) || v.desc?.toLowerCase().includes(q)).slice(0, 15);
    }, [allVars, filter]);

    // Detect `{{` in input and compute dropdown position
    const handleChange = useCallback((newValue, cursorPosition) => {
        onChange(newValue);

        // Find if cursor is inside a `{{...` that hasn't been closed
        const textBeforeCursor = newValue.slice(0, cursorPosition);
        const lastOpen = textBeforeCursor.lastIndexOf('{{');
        const lastClose = textBeforeCursor.lastIndexOf('}}');

        if (lastOpen !== -1 && lastOpen > lastClose) {
            // We're inside `{{ ... `
            const partial = textBeforeCursor.slice(lastOpen + 2);
            // Don't show if there's a space or newline in the partial
            if (!/[\s]/.test(partial)) {
                setFilter(partial);
                setTriggerPos(lastOpen);
                setSelectedIndex(0);
                setShowDropdown(true);

                // Compute dropdown position from input element
                if (inputRef?.current) {
                    const el = inputRef.current;
                    setDropdownPos({
                        left: 0,
                        top: el.getBoundingClientRect().height,
                    });
                }
                return;
            }
        }
        setShowDropdown(false);
    }, [onChange, inputRef]);

    const insertVariable = useCallback((item) => {
        if (triggerPos == null || !inputRef?.current) return;
        const el = inputRef.current;
        const cursorPos = el.selectionStart ?? value.length;
        const before = value.slice(0, triggerPos);
        const after = value.slice(cursorPos);
        const inserted = `${before}{{${item.key}}}${after}`;
        onChange(inserted);
        setShowDropdown(false);

        // Restore cursor position after React re-render
        const newPos = triggerPos + item.key.length + 4; // `{{` + key + `}}`
        requestAnimationFrame(() => {
            el.focus();
            el.setSelectionRange(newPos, newPos);
        });
    }, [triggerPos, value, onChange, inputRef]);

    const handleKeyDown = useCallback((e) => {
        if (!showDropdown) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => Math.min(prev + 1, filtered.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => Math.max(prev - 1, 0));
        } else if (e.key === 'Enter' || e.key === 'Tab') {
            if (filtered[selectedIndex]) {
                e.preventDefault();
                insertVariable(filtered[selectedIndex]);
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            setShowDropdown(false);
        }
    }, [showDropdown, filtered, selectedIndex, insertVariable]);

    const handleBlur = useCallback(() => {
        // Delay to allow onMouseDown on dropdown items
        setTimeout(() => setShowDropdown(false), 150);
    }, []);

    const dropdown = showDropdown && filtered.length > 0 ? (
        <AutocompleteDropdown
            items={filtered}
            selectedIndex={selectedIndex}
            onSelect={insertVariable}
            position={dropdownPos}
        />
    ) : null;

    return { handleChange, handleKeyDown, handleBlur, dropdown, showDropdown };
}

/**
 * A wrapped input element with variable autocomplete.
 * Drop-in replacement for <input> that shows {{variable}} suggestions.
 */
export function AutocompleteInput({ value, onChange, className, placeholder, onKeyDown: externalKeyDown, ...rest }) {
    const ref = useRef(null);
    const { handleChange, handleKeyDown, handleBlur, dropdown } = useVariableAutocomplete({
        value: value || '',
        onChange,
        inputRef: ref,
    });

    return (
        <div className="relative w-full h-full">
            <input
                ref={ref}
                type="text"
                value={value}
                onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
                onKeyDown={(e) => {
                    handleKeyDown(e);
                    if (!e.defaultPrevented && externalKeyDown) externalKeyDown(e);
                }}
                onBlur={handleBlur}
                className={className}
                placeholder={placeholder}
                {...rest}
            />
            {dropdown}
        </div>
    );
}

/**
 * A wrapped textarea element with variable autocomplete.
 * Drop-in replacement for <textarea> that shows {{variable}} suggestions.
 */
export function AutocompleteTextarea({ value, onChange, className, placeholder, onKeyDown: externalKeyDown, ...rest }) {
    const ref = useRef(null);
    const { handleChange, handleKeyDown, handleBlur, dropdown } = useVariableAutocomplete({
        value: value || '',
        onChange,
        inputRef: ref,
    });

    return (
        <div className="relative flex-1 flex flex-col">
            <textarea
                ref={ref}
                value={value}
                onChange={(e) => handleChange(e.target.value, e.target.selectionStart)}
                onKeyDown={(e) => {
                    handleKeyDown(e);
                    if (!e.defaultPrevented && externalKeyDown) externalKeyDown(e);
                }}
                onBlur={handleBlur}
                className={className}
                placeholder={placeholder}
                {...rest}
            />
            {dropdown}
        </div>
    );
}
