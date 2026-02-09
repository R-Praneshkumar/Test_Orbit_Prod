import React, { useState } from 'react';
import { X, Terminal, ArrowRight } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

const METHOD_COLORS = {
    GET: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30',
    POST: 'text-amber-600 bg-amber-50 dark:bg-amber-900/30',
    PUT: 'text-blue-600 bg-blue-50 dark:bg-blue-900/30',
    DELETE: 'text-rose-600 bg-rose-50 dark:bg-rose-900/30',
    PATCH: 'text-violet-600 bg-violet-50 dark:bg-violet-900/30',
};

// Parse a cURL command string into { method, url, headers, body }
function parseCurl(input) {
    const text = input.trim().replace(/\\\n/g, ' ').replace(/\\\r\n/g, ' ');

    let method = 'GET';
    let url = '';
    const headers = [];
    let body = '';

    // Extract method: -X POST or --request POST
    const methodMatch = text.match(/(?:-X|--request)\s+(\w+)/);
    if (methodMatch) method = methodMatch[1].toUpperCase();

    // Extract URL (first bare URL or quoted URL)
    const urlMatch = text.match(/curl\s+(?:['"](https?:\/\/[^'"]+)['"]|(https?:\/\/\S+))/) ||
                     text.match(/(?:^|\s)['"]?(https?:\/\/[^\s'"]+)['"]?/);
    if (urlMatch) url = urlMatch[1] || urlMatch[2] || urlMatch[3] || '';

    // Extract headers: -H "Key: Value" or --header "Key: Value"
    const headerRegex = /(?:-H|--header)\s+['"](.*?)['"]/g;
    let hMatch;
    while ((hMatch = headerRegex.exec(text)) !== null) {
        const colonIdx = hMatch[1].indexOf(':');
        if (colonIdx > 0) {
            headers.push({
                key: hMatch[1].substring(0, colonIdx).trim(),
                value: hMatch[1].substring(colonIdx + 1).trim(),
                enabled: true
            });
        }
    }

    // Extract body: -d '...' or --data '...' or --data-raw '...'
    const bodyMatch = text.match(/(?:-d|--data|--data-raw|--data-binary)\s+['"]([\s\S]*?)['"]/);
    if (bodyMatch) {
        body = bodyMatch[1];
        if (method === 'GET') method = 'POST'; // Auto-upgrade if body present
    }

    // Extract auth: -u user:pass
    const authMatch = text.match(/-u\s+['"]?(\S+?)['"]?(?:\s|$)/);
    if (authMatch) {
        const encoded = btoa(authMatch[1]);
        headers.push({ key: 'Authorization', value: `Basic ${encoded}`, enabled: true });
    }

    return { method, url, headers, body };
}

export const CurlImportModal = ({ onClose }) => {
    const [curlInput, setCurlInput] = useState('');
    const [parsed, setParsed] = useState(null);
    const [error, setError] = useState('');

    const addRequest = useWorkspaceStore(state => state.addRequest);
    const updateRequest = useWorkspaceStore(state => state.updateRequest);
    const activeCollectionId = useWorkspaceStore(state => state.activeCollectionId);
    const collections = useWorkspaceStore(state => state.collections);

    const handleParse = () => {
        setError('');
        if (!curlInput.trim()) return;

        try {
            const result = parseCurl(curlInput);
            if (!result.url) {
                setError('Could not extract a URL from the cURL command.');
                return;
            }
            setParsed(result);
        } catch (e) {
            setError(`Parse error: ${e.message}`);
        }
    };

    const handleImport = () => {
        if (!parsed) return;
        const colId = activeCollectionId || collections[0]?.id;
        if (!colId) return;

        // Create a new request via addRequest, then update it with parsed data
        const store = useWorkspaceStore.getState();
        store.addRequest(colId);
        const state = useWorkspaceStore.getState();
        const newReq = state.activeTabs[state.activeTabs.length - 1];
        if (newReq) {
            // Parse query params from URL
            const params = [];
            try {
                const urlObj = new URL(parsed.url);
                urlObj.searchParams.forEach((v, k) => {
                    params.push({ key: k, value: v, enabled: true });
                });
            } catch { /* ignore */ }

            store.updateRequest(newReq.id, {
                name: `Imported: ${parsed.method} ${new URL(parsed.url).pathname}`,
                method: parsed.method,
                url: parsed.url,
                headers: parsed.headers,
                params,
                body: { type: 'json', content: parsed.body || '' }
            });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center font-sans" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-[560px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-2">
                        <Terminal size={16} className="text-corporate-600 dark:text-corporate-400" />
                        <h2 className="font-semibold text-sm text-slate-800 dark:text-slate-100">Import from cURL</h2>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400">
                        <X size={16} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-5">
                    <textarea
                        value={curlInput}
                        onChange={(e) => { setCurlInput(e.target.value); setParsed(null); setError(''); }}
                        className="w-full h-32 text-xs font-mono p-3 border border-slate-200 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-900 dark:text-slate-200 resize-none outline-none focus:ring-2 focus:ring-corporate-500"
                        placeholder={`Paste a cURL command here...\n\nExample:\ncurl -X POST 'https://api.example.com/users' \\\n  -H 'Content-Type: application/json' \\\n  -d '{"name":"John","email":"john@example.com"}'`}
                    />

                    {!parsed && (
                        <button
                            onClick={handleParse}
                            disabled={!curlInput.trim()}
                            className="mt-3 bg-slate-800 dark:bg-slate-600 hover:bg-slate-900 dark:hover:bg-slate-500 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-colors"
                        >
                            Parse cURL
                        </button>
                    )}

                    {error && (
                        <div className="mt-3 text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2">
                            {error}
                        </div>
                    )}

                    {/* Preview */}
                    {parsed && (
                        <div className="mt-4 border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 dark:bg-slate-900 px-4 py-2 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                Parsed Request Preview
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="flex items-center gap-3">
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${METHOD_COLORS[parsed.method] || 'text-slate-500 bg-slate-50 dark:bg-slate-700'}`}>
                                        {parsed.method}
                                    </span>
                                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300 break-all">{parsed.url}</span>
                                </div>

                                {parsed.headers.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Headers ({parsed.headers.length})</div>
                                        {parsed.headers.map((h, idx) => (
                                            <div key={idx} className="text-[10px] font-mono text-slate-500 dark:text-slate-400 flex gap-2">
                                                <span className="text-slate-700 dark:text-slate-300 font-semibold">{h.key}:</span>
                                                <span className="truncate">{h.value}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {parsed.body && (
                                    <div>
                                        <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase mb-1">Body</div>
                                        <pre className="text-[10px] font-mono text-slate-600 dark:text-slate-300 bg-slate-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-700 max-h-32 overflow-auto whitespace-pre-wrap">
                                            {(() => {
                                                try { return JSON.stringify(JSON.parse(parsed.body), null, 2); }
                                                catch { return parsed.body; }
                                            })()}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {parsed && (
                    <div className="border-t border-slate-200 dark:border-slate-700 px-5 py-3 flex justify-end gap-2">
                        <button
                            onClick={() => { setParsed(null); setCurlInput(''); }}
                            className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 px-3 py-2 transition-colors"
                        >
                            Reset
                        </button>
                        <button
                            onClick={handleImport}
                            className="bg-corporate-600 hover:bg-corporate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <ArrowRight size={12} />
                            Import to {collections.find(c => c.id === activeCollectionId)?.name || 'Collection'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
