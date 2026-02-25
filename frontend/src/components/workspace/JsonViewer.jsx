import React, { useState, useMemo } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ChevronDown, ChevronUp, ArrowUp, ArrowDown } from 'lucide-react';

const COLLAPSE_THRESHOLD = 50; // lines

export const JsonViewer = ({ data, language = 'json', maxHeight = '400px', showLineNumbers = true }) => {
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const lines = text.split('\n');
    const isLong = lines.length > COLLAPSE_THRESHOLD;
    const displayText = (!expanded && isLong) ? lines.slice(0, COLLAPSE_THRESHOLD).join('\n') : text;

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard unavailable (non-HTTPS or permission denied)
        }
    };

    return (
        <div className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            {/* Copy button */}
            <button
                onClick={handleCopy}
                className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-slate-700/80 hover:bg-slate-600 text-slate-300 hover:text-white transition-all opacity-0 group-hover:opacity-100 flex items-center gap-1 text-[10px]"
            >
                {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
            </button>

            <SyntaxHighlighter
                language={language}
                style={oneDark}
                showLineNumbers={showLineNumbers}
                wrapLongLines
                customStyle={{
                    margin: 0,
                    padding: '12px',
                    fontSize: '11px',
                    maxHeight: expanded ? 'none' : maxHeight,
                    overflow: 'auto',
                    borderRadius: isLong && !expanded ? '8px 8px 0 0' : '8px',
                    background: '#1e1e2e',
                }}
                lineNumberStyle={{ color: '#4a4a6a', fontSize: '10px', minWidth: '2em' }}
            >
                {displayText}
            </SyntaxHighlighter>

            {/* Expand/Collapse for long content */}
            {isLong && (
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors border-t border-slate-700"
                >
                    {expanded ? <><ChevronUp size={12} /> Show less</> : <><ChevronDown size={12} /> Show all {lines.length} lines</>}
                </button>
            )}
        </div>
    );
};

export const TableViewer = ({ data }) => {
    const [sortKey, setSortKey] = useState(null);
    const [sortDir, setSortDir] = useState('asc');
    const [copied, setCopied] = useState(false);

    const columns = useMemo(() => {
        if (!Array.isArray(data) || data.length === 0) return [];
        return [...new Set(data.flatMap(row => Object.keys(row || {})))];
    }, [data]);

    const sortedData = useMemo(() => {
        if (!sortKey) return data;
        return [...data].sort((a, b) => {
            const va = a[sortKey];
            const vb = b[sortKey];
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            const cmp = typeof va === 'number' && typeof vb === 'number'
                ? va - vb
                : String(va).localeCompare(String(vb));
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [data, sortKey, sortDir]);

    const handleSort = (key) => {
        if (sortKey === key) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
        } else {
            setSortKey(key);
            setSortDir('asc');
        }
    };

    const handleCopyCSV = async () => {
        const header = columns.join(',');
        const rows = sortedData.map(row =>
            columns.map(c => {
                const v = row[c];
                const s = v == null ? '' : String(v);
                return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
            }).join(',')
        );
        try {
            await navigator.clipboard.writeText([header, ...rows].join('\n'));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch { /* clipboard unavailable */ }
    };

    const renderCell = (val) => {
        if (val === null || val === undefined) return <span className="text-slate-400 italic">null</span>;
        if (typeof val === 'object') return <span className="text-purple-400 font-mono">{JSON.stringify(val)}</span>;
        if (typeof val === 'boolean') return <span className={val ? 'text-green-500' : 'text-red-500'}>{String(val)}</span>;
        if (typeof val === 'number') return <span className="text-blue-400">{val}</span>;
        return <span className="text-slate-700 dark:text-slate-300">{String(val)}</span>;
    };

    if (!Array.isArray(data) || columns.length === 0) return null;

    return (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">{data.length} rows &times; {columns.length} cols</span>
                <button onClick={handleCopyCSV} className="text-[10px] px-2 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors flex items-center gap-1">
                    {copied ? <><Check size={10} /> Copied</> : <><Copy size={10} /> Copy CSV</>}
                </button>
            </div>
            <div className="max-h-[400px] overflow-auto">
                <table className="w-full text-[11px]">
                    <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900">
                        <tr>
                            <th className="px-2 py-1.5 text-[9px] text-slate-400 font-bold border-r border-slate-200 dark:border-slate-700 w-8">#</th>
                            {columns.map(col => (
                                <th
                                    key={col}
                                    onClick={() => handleSort(col)}
                                    className="px-2 py-1.5 text-left text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase cursor-pointer hover:text-corporate-600 dark:hover:text-corporate-400 border-r border-slate-200 dark:border-slate-700 last:border-r-0 select-none"
                                >
                                    <span className="flex items-center gap-0.5">
                                        {col}
                                        {sortKey === col && (sortDir === 'asc' ? <ArrowUp size={9} /> : <ArrowDown size={9} />)}
                                    </span>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {sortedData.map((row, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                <td className="px-2 py-1 text-[9px] text-slate-400 font-mono border-r border-slate-100 dark:border-slate-700 text-center">{idx + 1}</td>
                                {columns.map(col => (
                                    <td key={col} className="px-2 py-1 font-mono border-r border-slate-100 dark:border-slate-700 last:border-r-0 max-w-[200px] truncate">
                                        {renderCell(row[col])}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export const CodeViewer = ({ code, language = 'python', filename }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            // Clipboard unavailable (non-HTTPS or permission denied)
        }
    };

    return (
        <div className="relative group rounded-lg overflow-hidden border border-slate-200 dark:border-slate-700">
            {/* Header with filename and copy */}
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800 border-b border-slate-700">
                {filename && <span className="text-[10px] text-slate-400 font-mono">{filename}</span>}
                <button
                    onClick={handleCopy}
                    className="p-1 rounded text-slate-400 hover:text-white transition-colors flex items-center gap-1 text-[10px]"
                >
                    {copied ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                </button>
            </div>

            <SyntaxHighlighter
                language={language}
                style={oneDark}
                showLineNumbers
                wrapLongLines
                customStyle={{
                    margin: 0,
                    padding: '12px',
                    fontSize: '11px',
                    maxHeight: '500px',
                    overflow: 'auto',
                    borderRadius: 0,
                    background: '#1e1e2e',
                }}
                lineNumberStyle={{ color: '#4a4a6a', fontSize: '10px', minWidth: '2em' }}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    );
};
