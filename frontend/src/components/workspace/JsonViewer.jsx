import React, { useState } from 'react';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check, ChevronDown, ChevronUp } from 'lucide-react';

const COLLAPSE_THRESHOLD = 50; // lines

export const JsonViewer = ({ data, language = 'json', maxHeight = '400px', showLineNumbers = true }) => {
    const [copied, setCopied] = useState(false);
    const [expanded, setExpanded] = useState(false);

    const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
    const lines = text.split('\n');
    const isLong = lines.length > COLLAPSE_THRESHOLD;
    const displayText = (!expanded && isLong) ? lines.slice(0, COLLAPSE_THRESHOLD).join('\n') : text;

    const handleCopy = async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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

export const CodeViewer = ({ code, language = 'python', filename }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
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
