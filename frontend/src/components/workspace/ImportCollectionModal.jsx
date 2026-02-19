import React, { useState, useRef } from 'react';
import { X, Upload, FileText, CheckCircle, AlertCircle, FileJson, Globe } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';
import { v4 as uuidv4 } from 'uuid';

// --- Format Parsers ---

function parsePostmanCollection(json) {
    const mapItem = (item) => {
        if (item.item) {
            return {
                id: uuidv4(), name: item.name || 'Folder', type: 'folder',
                items: item.item.map(mapItem)
            };
        }
        const req = item.request || {};
        return {
            id: uuidv4(), name: item.name || 'Request', type: 'request',
            method: req.method || 'GET',
            url: typeof req.url === 'string' ? req.url : req.url?.raw || '',
            headers: (req.header || []).map(h => ({ key: h.key, value: h.value, enabled: !h.disabled })),
            params: [],
            body: { type: 'json', content: req.body?.raw || '' },
            preScript: '',
            postScript: '',
        };
    };
    return {
        name: json.info?.name || 'Imported Collection',
        items: (json.item || []).map(mapItem),
        format: 'Postman v2.1',
    };
}

function parseInsomniaExport(json) {
    const resources = json.resources || [];
    const requests = resources.filter(r => r._type === 'request');
    const folders = resources.filter(r => r._type === 'request_group');
    const workspace = resources.find(r => r._type === 'workspace');

    // Build folder map
    const folderMap = {};
    folders.forEach(f => { folderMap[f._id] = { id: uuidv4(), name: f.name, type: 'folder', items: [] }; });

    const items = [];

    requests.forEach(req => {
        const item = {
            id: uuidv4(),
            name: req.name || 'Request',
            type: 'request',
            method: req.method || 'GET',
            url: req.url || '',
            headers: (req.headers || []).map(h => ({ key: h.name, value: h.value, enabled: !h.disabled })),
            params: (req.parameters || []).map(p => ({ key: p.name, value: p.value, enabled: !p.disabled })),
            body: { type: 'json', content: req.body?.text || '' },
            preScript: '',
            postScript: '',
        };

        if (req.parentId && folderMap[req.parentId]) {
            folderMap[req.parentId].items.push(item);
        } else {
            items.push(item);
        }
    });

    // Add non-empty folders
    Object.values(folderMap).forEach(f => {
        if (f.items.length > 0) items.unshift(f);
    });

    return {
        name: workspace?.name || json.__export_source || 'Insomnia Import',
        items,
        format: 'Insomnia v4',
    };
}

function parseOpenApiSpec(json) {
    const baseUrl = json.servers?.[0]?.url || (json.host ? `https://${json.host}${json.basePath || ''}` : '');
    const title = json.info?.title || 'OpenAPI Import';
    const paths = json.paths || {};

    const genExample = (schema, spec, depth = 0) => {
        if (!schema || depth > 5) return 'string';
        if (schema.$ref) {
            const parts = schema.$ref.replace('#/', '').split('/');
            let resolved = spec;
            for (const p of parts) resolved = resolved?.[p];
            return genExample(resolved, spec, depth + 1);
        }
        if (schema.example !== undefined) return schema.example;
        switch (schema.type) {
            case 'string':
                if (schema.format === 'email') return 'user@example.com';
                if (schema.format === 'date-time') return new Date().toISOString();
                if (schema.enum) return schema.enum[0];
                return schema.default || 'string';
            case 'integer': case 'number':
                return schema.default ?? schema.minimum ?? 0;
            case 'boolean':
                return schema.default ?? true;
            case 'array':
                return [genExample(schema.items, spec, depth + 1)];
            case 'object': {
                if (!schema.properties) return {};
                const obj = {};
                for (const [k, v] of Object.entries(schema.properties)) obj[k] = genExample(v, spec, depth + 1);
                return obj;
            }
            default:
                if (schema.properties) {
                    const obj = {};
                    for (const [k, v] of Object.entries(schema.properties)) obj[k] = genExample(v, spec, depth + 1);
                    return obj;
                }
                return 'string';
        }
    };

    const METHODS = ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'];
    const items = [];

    for (const [path, pathItem] of Object.entries(paths)) {
        for (const method of METHODS) {
            const op = pathItem[method];
            if (!op) continue;

            const fullUrl = `${baseUrl}${path}`;
            const name = op.summary || op.operationId || `${method.toUpperCase()} ${path}`;

            const params = [];
            const headers = [];
            for (const param of (op.parameters || pathItem.parameters || [])) {
                const val = param.example ?? param.schema?.example ?? '';
                if (param.in === 'query') {
                    params.push({ key: param.name, value: String(val), enabled: !!param.required });
                } else if (param.in === 'header') {
                    headers.push({ key: param.name, value: String(val), enabled: true });
                }
            }

            let bodyContent = '';
            const rb = op.requestBody;
            if (rb) {
                const jsonSchema = rb.content?.['application/json']?.schema;
                if (jsonSchema) {
                    const example = rb.content['application/json'].example || genExample(jsonSchema, json);
                    bodyContent = JSON.stringify(example, null, 2);
                }
            }

            items.push({
                id: uuidv4(), name, type: 'request',
                method: method.toUpperCase(), url: fullUrl,
                headers, params,
                body: { type: 'json', content: bodyContent },
                preScript: '',
                postScript: '',
            });
        }
    }

    return {
        name: title,
        items,
        format: `OpenAPI ${json.openapi || json.swagger || ''}`.trim(),
        openApiSpec: JSON.stringify(json),
        baseUrl,
    };
}

function parseThunderClient(json) {
    const requests = json.requests || json || [];
    const items = (Array.isArray(requests) ? requests : []).map(req => ({
        id: uuidv4(),
        name: req.name || req.colName || 'Request',
        type: 'request',
        method: req.method || 'GET',
        url: req.url || '',
        headers: (req.headers || []).map(h => ({ key: h.name || h.key, value: h.value, enabled: true })),
        params: [],
        body: { type: 'json', content: typeof req.body === 'string' ? req.body : (req.body?.raw || '') },
        preScript: '',
        postScript: '',
    }));

    return {
        name: json.collectionName || json.name || 'Thunder Client Import',
        items,
        format: 'Thunder Client',
    };
}

// --- Auto-detect format ---
function detectAndParse(text) {
    let json;
    try {
        json = JSON.parse(text);
    } catch {
        return { error: 'Invalid JSON. Please paste a valid JSON collection file.' };
    }

    // Postman v2.1
    if (json.info?.schema?.includes('getpostman.com') || json.info?._postman_id || (json.info && json.item)) {
        return parsePostmanCollection(json);
    }

    // Insomnia v4
    if (json.__export_format === 4 || json._type === 'export' || json.resources) {
        return parseInsomniaExport(json);
    }

    // OpenAPI 3.x
    if (json.openapi && json.paths) {
        return parseOpenApiSpec(json);
    }

    // Swagger 2.0
    if (json.swagger && json.paths) {
        return parseOpenApiSpec(json);
    }

    // Thunder Client
    if (json.requests || (Array.isArray(json) && json[0]?.method)) {
        return parseThunderClient(json);
    }

    // Last attempt: if it has 'item' array, try Postman-like
    if (json.item && Array.isArray(json.item)) {
        return parsePostmanCollection(json);
    }

    return { error: 'Unrecognized format. Supports: Postman v2.1, Insomnia v4, OpenAPI/Swagger, Thunder Client.' };
}

// --- Component ---

export const ImportCollectionModal = ({ onClose }) => {
    const [content, setContent] = useState('');
    const [result, setResult] = useState(null);
    const [preview, setPreview] = useState(null);
    const fileRef = useRef(null);

    const handleFile = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setContent(ev.target.result);
            tryParse(ev.target.result);
        };
        reader.readAsText(file);
    };

    const tryParse = (text) => {
        const parsed = detectAndParse(text || content);
        if (parsed.error) {
            setResult({ error: parsed.error });
            setPreview(null);
        } else {
            setPreview(parsed);
            setResult(null);
        }
    };

    const handleImport = () => {
        if (!preview) return;
        const store = useWorkspaceStore.getState();
        const newCol = {
            id: uuidv4(),
            name: preview.name,
            type: 'collection',
            items: preview.items,
            chatMessages: [],
            openApiSpec: preview.openApiSpec || '',
            baseUrl: preview.baseUrl || '',
            runHistory: [],
            testSuites: [],
        };
        useWorkspaceStore.setState({
            collections: [...store.collections, newCol],
            activeCollectionId: newCol.id,
        });
        // Sync to Supabase
        useWorkspaceStore.getState().saveCollectionToSupabase(newCol.id);
        setResult({ success: true, name: preview.name, count: countRequests(preview.items), format: preview.format });
        // Close modal after brief success display
        setTimeout(onClose, 1500);
    };

    const countRequests = (items) => {
        let count = 0;
        for (const item of items) {
            if (item.type === 'request') count++;
            if (item.items) count += countRequests(item.items);
        }
        return count;
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            setContent(ev.target.result);
            tryParse(ev.target.result);
        };
        reader.readAsText(file);
    };

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-[520px] max-h-[80vh] overflow-hidden" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
                    <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Upload size={16} />
                        Import Collection
                    </h2>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400">
                        <X size={16} />
                    </button>
                </div>

                <div className="p-5">
                    {/* Supported formats badge */}
                    <div className="flex flex-wrap gap-1.5 mb-4">
                        {['Postman v2.1', 'Insomnia v4', 'OpenAPI 3.x', 'Swagger 2.0', 'Thunder Client'].map(fmt => (
                            <span key={fmt} className="text-[9px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-medium">
                                {fmt}
                            </span>
                        ))}
                    </div>

                    {/* Drop zone */}
                    <div
                        onDrop={handleDrop}
                        onDragOver={e => e.preventDefault()}
                        className="border-2 border-dashed border-slate-200 dark:border-slate-600 rounded-lg p-8 text-center cursor-pointer hover:border-corporate-400 dark:hover:border-corporate-500 transition-colors mb-4"
                        onClick={() => fileRef.current?.click()}
                    >
                        <Upload size={32} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                        <p className="text-sm text-slate-600 dark:text-slate-300 font-medium">Drop a collection file here</p>
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">or click to browse (.json)</p>
                        <input ref={fileRef} type="file" accept=".json" onChange={handleFile} className="hidden" />
                    </div>

                    {/* Or paste JSON */}
                    <div className="mb-4">
                        <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 block">Or paste JSON</label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            className="w-full text-[10px] p-3 border border-slate-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 rounded-lg font-mono resize-none outline-none focus:ring-2 focus:ring-corporate-500"
                            rows={4}
                            placeholder='Paste Postman, Insomnia, OpenAPI, or Thunder Client JSON...'
                        />
                        <button
                            onClick={() => tryParse(content)}
                            disabled={!content.trim()}
                            className="mt-2 text-[10px] font-bold bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white px-3 py-1.5 rounded transition-colors"
                        >
                            Parse
                        </button>
                    </div>

                    {/* Preview */}
                    {preview && (
                        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <FileText size={14} className="text-green-600 dark:text-green-400" />
                                <span className="text-xs font-semibold text-green-700 dark:text-green-300">{preview.name}</span>
                                <span className="text-[9px] bg-green-100 dark:bg-green-800 text-green-600 dark:text-green-300 px-1.5 py-0.5 rounded-full font-medium ml-auto">
                                    {preview.format}
                                </span>
                            </div>
                            <p className="text-[10px] text-green-600 dark:text-green-400">{countRequests(preview.items)} requests found</p>
                            {preview.baseUrl && (
                                <p className="text-[10px] text-green-500 dark:text-green-400 flex items-center gap-1 mt-1">
                                    <Globe size={9} /> Base URL: {preview.baseUrl}
                                </p>
                            )}
                            <button
                                onClick={handleImport}
                                className="mt-2 w-full bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded transition-colors"
                            >
                                Import Collection
                            </button>
                        </div>
                    )}

                    {/* Result feedback */}
                    {result && (
                        <div className={`p-3 rounded-lg text-xs ${
                            result.success
                                ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800'
                                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-800'
                        }`}>
                            {result.success ? (
                                <span className="flex items-center gap-1">
                                    <CheckCircle size={12} />
                                    Imported "{result.name}" ({result.format}) with {result.count} requests
                                </span>
                            ) : (
                                <span className="flex items-center gap-1">
                                    <AlertCircle size={12} />
                                    {result.error}
                                </span>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
