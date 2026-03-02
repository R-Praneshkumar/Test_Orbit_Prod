import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plug, Unplug, Send, Trash2, ArrowDownLeft, ArrowUpRight, Clock, Activity, CheckCircle, XCircle, Copy } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

const STATUS_CONFIG = {
    disconnected: { label: 'Disconnected', color: 'text-slate-400 dark:text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', dot: 'bg-slate-400' },
    connecting: { label: 'Connecting...', color: 'text-amber-500', bg: 'bg-amber-50 dark:bg-amber-900/20', dot: 'bg-amber-400 animate-pulse' },
    connected: { label: 'Connected', color: 'text-green-500', bg: 'bg-green-50 dark:bg-green-900/20', dot: 'bg-green-400' },
    error: { label: 'Error', color: 'text-red-500', bg: 'bg-red-50 dark:bg-red-900/20', dot: 'bg-red-400' },
};

export const WebSocketTester = ({ tabId }) => {
    const updateRequest = useWorkspaceStore(state => state.updateRequest);
    const tab = useWorkspaceStore(state => state.activeTabs.find(t => t.id === tabId));

    const [status, setStatus] = useState('disconnected');
    const [messages, setMessages] = useState([]);
    const [inputMsg, setInputMsg] = useState('');
    const [localUrl, setLocalUrl] = useState(tab?.url || 'wss://');
    const [protocols, setProtocols] = useState('');
    const [autoScroll] = useState(true);
    const [filter, setFilter] = useState('all'); // 'all' | 'sent' | 'received'

    const wsRef = useRef(null);
    const messagesEndRef = useRef(null);
    const connectTimeRef = useRef(null);

    // Sync URL from tab
    // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
    useEffect(() => { setLocalUrl(tab?.url || 'wss://'); }, [tab?.id]);

    // Auto-scroll
    useEffect(() => {
        if (autoScroll && messagesEndRef.current) {
            messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, autoScroll]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
        };
    }, []);

    // Cap messages at 500 to prevent memory leaks in long sessions
    const appendMessage = useCallback((msg) => {
        setMessages(prev => {
            const next = [...prev, msg];
            return next.length > 500 ? next.slice(-500) : next;
        });
    }, []);

    const addSystemMsg = useCallback((text, level = 'info') => {
        appendMessage({
            id: Date.now() + Math.random(),
            type: 'system',
            data: text,
            level,
            timestamp: Date.now(),
        });
    }, [appendMessage]);

    const handleConnect = useCallback(() => {
        if (wsRef.current) {
            // Null out handlers before closing to prevent stale callbacks firing
            wsRef.current.onopen = null;
            wsRef.current.onmessage = null;
            wsRef.current.onerror = null;
            wsRef.current.onclose = null;
            wsRef.current.close();
            wsRef.current = null;
        }

        setStatus('connecting');
        connectTimeRef.current = Date.now();

        // Save URL to store
        updateRequest(tabId, { url: localUrl });

        try {
            const protoArray = protocols.trim()
                ? protocols.split(',').map(p => p.trim()).filter(Boolean)
                : undefined;
            const ws = protoArray
                ? new WebSocket(localUrl, protoArray)
                : new WebSocket(localUrl);

            ws.onopen = () => {
                setStatus('connected');
                addSystemMsg(`Connected to ${localUrl}`, 'success');
            };

            ws.onmessage = (event) => {
                const data = event.data;
                let parsed = data;
                let isJson = false;
                try {
                    parsed = JSON.parse(data);
                    isJson = true;
                } catch { /* not JSON */ }

                appendMessage({
                    id: Date.now() + Math.random(),
                    type: 'received',
                    data: isJson ? JSON.stringify(parsed, null, 2) : data,
                    isJson,
                    timestamp: Date.now(),
                    size: new Blob([data]).size,
                });
            };

            ws.onerror = () => {
                setStatus('error');
                addSystemMsg('Connection error occurred', 'error');
            };

            ws.onclose = (event) => {
                const duration = connectTimeRef.current ? Date.now() - connectTimeRef.current : 0;
                setStatus('disconnected');
                addSystemMsg(
                    `Disconnected (code: ${event.code}${event.reason ? `, reason: ${event.reason}` : ''}) — ${(duration / 1000).toFixed(1)}s session`,
                    'info'
                );
                wsRef.current = null;
            };

            wsRef.current = ws;
        } catch (err) {
            setStatus('error');
            addSystemMsg(`Failed to connect: ${err.message}`, 'error');
        }
    }, [localUrl, protocols, tabId, updateRequest, addSystemMsg, appendMessage]);

    const handleDisconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    const handleSend = useCallback(() => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN || !inputMsg.trim()) return;

        wsRef.current.send(inputMsg);
        appendMessage({
            id: Date.now() + Math.random(),
            type: 'sent',
            data: inputMsg,
            isJson: (() => { try { JSON.parse(inputMsg); return true; } catch { return false; } })(),
            timestamp: Date.now(),
            size: new Blob([inputMsg]).size,
        });
        setInputMsg('');
    }, [inputMsg, appendMessage]);



    const clearMessages = () => setMessages([]);

    const filteredMessages = filter === 'all'
        ? messages
        : messages.filter(m => m.type === filter || m.type === 'system');

    const sentCount = messages.filter(m => m.type === 'sent').length;
    const receivedCount = messages.filter(m => m.type === 'received').length;
    const statusCfg = STATUS_CONFIG[status];

    if (!tab) return null;

    return (
        <div className="flex-1 flex flex-col bg-white dark:bg-slate-900 h-full font-sans">
            {/* Top Bar: URL & Connect */}
            <div className="h-14 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-3 bg-white dark:bg-slate-900 shadow-sm z-10">
                {/* Status Dot */}
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusCfg.dot}`} title={statusCfg.label} />

                <div className="flex-1 flex items-center border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-800 focus-within:ring-2 focus-within:ring-corporate-500/20 focus-within:border-corporate-500 transition-all h-10">
                    <span className="px-3 text-[10px] font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider border-r border-slate-300 dark:border-slate-600 h-full flex items-center bg-violet-50 dark:bg-violet-900/20 rounded-l-lg">
                        WS
                    </span>
                    <input
                        type="text"
                        value={localUrl}
                        onChange={(e) => setLocalUrl(e.target.value)}
                        className="flex-1 bg-transparent px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none placeholder-slate-400 dark:placeholder-slate-500 font-mono h-full"
                        placeholder="wss://echo.websocket.org"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
                        disabled={status === 'connected'}
                    />
                </div>

                {status === 'connected' ? (
                    <button
                        onClick={handleDisconnect}
                        className="bg-red-500 hover:bg-red-600 text-white px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-md transition-all active:scale-95"
                    >
                        <Unplug size={16} />
                        <span>Disconnect</span>
                    </button>
                ) : (
                    <button
                        onClick={handleConnect}
                        disabled={status === 'connecting' || !localUrl.trim()}
                        className="bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-700 hover:to-violet-600 disabled:from-violet-300 disabled:to-violet-300 text-white px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 shadow-md shadow-violet-200 dark:shadow-none transition-all active:scale-95"
                    >
                        {status === 'connecting' ? (
                            <><Activity size={16} className="animate-spin" /><span>Connecting...</span></>
                        ) : (
                            <><Plug size={16} /><span>Connect</span></>
                        )}
                    </button>
                )}
            </div>

            {/* Protocols bar */}
            <div className="h-9 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-3 bg-slate-50 dark:bg-slate-800 text-xs">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase shrink-0">Protocols</span>
                <input
                    type="text"
                    value={protocols}
                    onChange={(e) => setProtocols(e.target.value)}
                    placeholder="e.g. graphql-ws, mqtt (comma separated)"
                    className="flex-1 bg-transparent text-xs text-slate-600 dark:text-slate-400 outline-none placeholder-slate-400 dark:placeholder-slate-500"
                    disabled={status === 'connected'}
                />
                <div className="flex items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                    <span className={`flex items-center gap-1 ${statusCfg.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                        {statusCfg.label}
                    </span>
                    <span className="flex items-center gap-0.5">
                        <ArrowUpRight size={9} /> {sentCount}
                    </span>
                    <span className="flex items-center gap-0.5">
                        <ArrowDownLeft size={9} /> {receivedCount}
                    </span>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Message Log */}
                <div className="flex-1 flex flex-col min-w-0">
                    {/* Filter Bar */}
                    <div className="h-8 border-b border-slate-200 dark:border-slate-700 flex items-center px-3 gap-1 bg-white dark:bg-slate-900">
                        {['all', 'sent', 'received'].map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-2.5 py-0.5 text-[10px] font-semibold rounded-full capitalize transition-colors ${filter === f
                                        ? 'bg-corporate-100 dark:bg-corporate-900/30 text-corporate-700 dark:text-corporate-400'
                                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                        <div className="flex-1" />
                        <button
                            onClick={clearMessages}
                            className="text-[10px] text-slate-400 dark:text-slate-500 hover:text-red-500 flex items-center gap-1 transition-colors"
                            title="Clear messages"
                        >
                            <Trash2 size={10} /> Clear
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-1">
                        {filteredMessages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-300 dark:text-slate-600">
                                <Plug size={32} className="mb-2 opacity-30" />
                                <span className="text-xs">
                                    {status === 'connected'
                                        ? 'Waiting for messages...'
                                        : 'Connect to a WebSocket server to begin'}
                                </span>
                            </div>
                        ) : (
                            filteredMessages.map(msg => (
                                <div
                                    key={msg.id}
                                    className={`group flex items-start gap-2 text-xs rounded-lg p-2 animate-fade-in ${msg.type === 'sent'
                                            ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800'
                                            : msg.type === 'received'
                                                ? 'bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-800'
                                                : msg.level === 'error'
                                                    ? 'bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900'
                                                    : msg.level === 'success'
                                                        ? 'bg-green-50 dark:bg-green-900/10 border border-green-100 dark:border-green-900'
                                                        : 'bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700'
                                        }`}
                                >
                                    {/* Direction Icon */}
                                    <div className="shrink-0 mt-0.5">
                                        {msg.type === 'sent' && <ArrowUpRight size={12} className="text-blue-500" />}
                                        {msg.type === 'received' && <ArrowDownLeft size={12} className="text-green-500" />}
                                        {msg.type === 'system' && (
                                            msg.level === 'error' ? <XCircle size={12} className="text-red-500" /> :
                                                msg.level === 'success' ? <CheckCircle size={12} className="text-green-500" /> :
                                                    <Activity size={12} className="text-slate-400" />
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <pre className={`whitespace-pre-wrap break-all font-mono text-[11px] ${msg.type === 'system'
                                                ? msg.level === 'error' ? 'text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-slate-400 italic'
                                                : 'text-slate-700 dark:text-slate-300'
                                            }`}>
                                            {msg.data}
                                        </pre>
                                    </div>

                                    {/* Meta */}
                                    <div className="shrink-0 flex flex-col items-end gap-0.5">
                                        <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono">
                                            {new Date(msg.timestamp).toLocaleTimeString()}
                                        </span>
                                        {msg.size !== undefined && (
                                            <span className="text-[9px] text-slate-400 dark:text-slate-500">
                                                {msg.size}B
                                            </span>
                                        )}
                                        {msg.type !== 'system' && (
                                            <button
                                                onClick={() => navigator.clipboard.writeText(msg.data)}
                                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-opacity"
                                                title="Copy"
                                            >
                                                <Copy size={10} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Send Bar */}
                    <div className="h-12 border-t border-slate-200 dark:border-slate-700 flex items-center gap-2 px-3 bg-white dark:bg-slate-900">
                        <textarea
                            value={inputMsg}
                            onChange={(e) => setInputMsg(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            className="flex-1 text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 resize-none outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 text-slate-700 dark:text-slate-300 placeholder-slate-400 dark:placeholder-slate-500 h-8"
                            placeholder={status === 'connected' ? 'Type a message... (Enter to send, Shift+Enter for newline)' : 'Connect first to send messages'}
                            disabled={status !== 'connected'}
                            rows={1}
                        />
                        <button
                            onClick={handleSend}
                            disabled={status !== 'connected' || !inputMsg.trim()}
                            className="bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white p-2 rounded-lg transition-colors active:scale-95"
                            title="Send message"
                        >
                            <Send size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
