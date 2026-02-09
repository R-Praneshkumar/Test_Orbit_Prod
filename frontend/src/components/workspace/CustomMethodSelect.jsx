import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

const METHODS = [
    { value: 'GET', color: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30' },
    { value: 'POST', color: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30' },
    { value: 'PUT', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30' },
    { value: 'DELETE', color: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30' },
    { value: 'PATCH', color: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30' }
];

export const CustomMethodSelect = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (ref.current && !ref.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selected = METHODS.find(m => m.value === value) || METHODS[0];

    return (
        <div className="relative font-sans" ref={ref}>
            {/* Trigger */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
            h-full flex items-center gap-1.5 px-3 py-2 text-xs font-bold tracking-tight rounded-l-lg border-r border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors outline-none
            ${selected.color}
        `}
            >
                <span>{selected.value}</span>
                <ChevronDown size={12} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 mt-1 w-32 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100">
                    <div className="py-1">
                        {METHODS.map((method) => (
                            <button
                                key={method.value}
                                onClick={() => {
                                    onChange(method.value);
                                    setIsOpen(false);
                                }}
                                className={`
                    w-full text-left px-3 py-2 text-xs font-semibold flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors
                    ${method.value === value ? method.color : 'text-slate-600 dark:text-slate-300'}
                `}
                            >
                                <span>{method.value}</span>
                                {method.value === value && <Check size={12} />}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
