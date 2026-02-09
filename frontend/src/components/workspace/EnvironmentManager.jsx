import React, { useState } from 'react';
import { X, Plus, Trash2, Globe, Eye, EyeOff } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

export const EnvironmentManager = ({ onClose }) => {
    const environments = useWorkspaceStore(state => state.environments);
    const activeEnv = useWorkspaceStore(state => state.activeEnv);
    const setActiveEnv = useWorkspaceStore(state => state.setActiveEnv);
    const addEnvironment = useWorkspaceStore(state => state.addEnvironment);
    const deleteEnvironment = useWorkspaceStore(state => state.deleteEnvironment);
    const updateEnvVars = useWorkspaceStore(state => state.updateEnvVars);

    const [selectedEnv, setSelectedEnv] = useState(activeEnv);
    const [showValues, setShowValues] = useState(false);

    const currentEnv = environments.find(e => e.name === selectedEnv);
    const vars = currentEnv?.vars || [];

    const updateRow = (index, field, value) => {
        const newVars = [...vars];
        newVars[index] = { ...newVars[index], [field]: value };
        updateEnvVars(selectedEnv, newVars);
    };

    const addRow = () => {
        updateEnvVars(selectedEnv, [...vars, { key: '', value: '', enabled: true }]);
    };

    const deleteRow = (index) => {
        updateEnvVars(selectedEnv, vars.filter((_, i) => i !== index));
    };

    const handleAddEnv = () => {
        const name = prompt('Environment name:');
        if (name?.trim()) {
            addEnvironment(name.trim());
            setSelectedEnv(name.trim());
        }
    };

    return (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center font-sans" onClick={onClose}>
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-[640px] max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="h-12 border-b border-slate-200 dark:border-slate-700 flex items-center px-5 justify-between">
                    <div className="flex items-center gap-2">
                        <Globe size={16} className="text-corporate-600 dark:text-corporate-400" />
                        <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">Environment Variables</span>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-400">
                        <X size={16} />
                    </button>
                </div>

                {/* Env Tabs */}
                <div className="flex items-center gap-2 px-5 py-3 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900">
                    {environments.map(env => (
                        <button
                            key={env.name}
                            onClick={() => setSelectedEnv(env.name)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
                                selectedEnv === env.name
                                    ? 'bg-corporate-600 text-white'
                                    : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-corporate-300 dark:hover:border-corporate-600'
                            }`}
                        >
                            {env.name === activeEnv && <span className="w-1.5 h-1.5 bg-green-400 rounded-full" />}
                            {env.name}
                        </button>
                    ))}
                    <button
                        onClick={handleAddEnv}
                        className="px-2 py-1.5 text-xs text-slate-400 dark:text-slate-500 hover:text-corporate-600 dark:hover:text-corporate-400 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 hover:border-corporate-400 dark:hover:border-corporate-500 transition-colors"
                    >
                        <Plus size={12} />
                    </button>
                </div>

                {/* Active Env Selector + Actions */}
                <div className="flex items-center justify-between px-5 py-2 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span>Active:</span>
                        <select
                            value={activeEnv}
                            onChange={(e) => setActiveEnv(e.target.value)}
                            className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded px-2 py-1 text-slate-700 dark:text-slate-300 outline-none focus:ring-1 focus:ring-corporate-500"
                        >
                            {environments.map(e => (
                                <option key={e.name} value={e.name}>{e.name}</option>
                            ))}
                        </select>
                    </div>
                    {selectedEnv !== 'Global' && (
                        <button
                            onClick={() => {
                                if (confirm(`Delete environment "${selectedEnv}"?`)) {
                                    deleteEnvironment(selectedEnv);
                                    setSelectedEnv('Global');
                                }
                            }}
                            className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
                        >
                            <Trash2 size={11} /> Delete Env
                        </button>
                    )}
                </div>

                {/* Variable Table */}
                <div className="flex-1 overflow-y-auto">
                    {/* Table Header */}
                    <div className="flex bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider sticky top-0">
                        <div className="w-8 py-2 text-center border-r border-slate-200 dark:border-slate-700"></div>
                        <div className="flex-1 py-2 px-3 border-r border-slate-200 dark:border-slate-700">Variable Name</div>
                        <div className="flex-1 py-2 px-3 border-r border-slate-200 dark:border-slate-700 flex items-center gap-1">
                            Value
                            <button onClick={() => setShowValues(!showValues)} className="ml-1 text-slate-400 hover:text-corporate-600 dark:hover:text-corporate-400 transition-colors" title={showValues ? 'Hide values' : 'Show values'}>
                                {showValues ? <Eye size={10} /> : <EyeOff size={10} />}
                            </button>
                        </div>
                        <div className="w-10 py-2 text-center"></div>
                    </div>

                    {/* Rows */}
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {vars.map((row, index) => (
                            <div key={index} className="flex group bg-white dark:bg-slate-800 hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors">
                                <div className="w-8 flex items-center justify-center border-r border-slate-100 dark:border-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={row.enabled !== false}
                                        onChange={(e) => updateRow(index, 'enabled', e.target.checked)}
                                        className="rounded border-slate-300 dark:border-slate-600 text-corporate-600 focus:ring-0 w-3 h-3 cursor-pointer"
                                    />
                                </div>
                                <div className="flex-1 border-r border-slate-100 dark:border-slate-700">
                                    <input
                                        type="text"
                                        value={row.key}
                                        onChange={(e) => updateRow(index, 'key', e.target.value)}
                                        placeholder="variable_name"
                                        className="w-full h-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 font-mono outline-none bg-transparent placeholder-slate-300 dark:placeholder-slate-600"
                                    />
                                </div>
                                <div className="flex-1 border-r border-slate-100 dark:border-slate-700">
                                    <input
                                        type={showValues ? 'text' : 'password'}
                                        value={row.value}
                                        onChange={(e) => updateRow(index, 'value', e.target.value)}
                                        placeholder="value"
                                        className="w-full h-full px-3 py-2 text-xs text-slate-700 dark:text-slate-300 font-mono outline-none bg-transparent placeholder-slate-300 dark:placeholder-slate-600"
                                    />
                                </div>
                                <div className="w-10 flex items-center justify-center">
                                    <button
                                        onClick={() => deleteRow(index)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-slate-300 dark:text-slate-600 transition-all"
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Add Row */}
                    <button
                        onClick={addRow}
                        className="m-3 flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-corporate-600 dark:hover:text-corporate-400 px-2 py-1 rounded transition-colors"
                    >
                        <Plus size={12} />
                        <span>Add Variable</span>
                    </button>

                    {vars.length === 0 && (
                        <div className="px-5 py-8 text-center text-xs text-slate-400 dark:text-slate-500">
                            No variables defined. Use <code className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded text-[10px]">{'{{variable_name}}'}</code> in URLs, headers, or body to reference them.
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="h-10 border-t border-slate-200 dark:border-slate-700 flex items-center px-5 text-[10px] text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-900">
                    Use <code className="bg-slate-100 dark:bg-slate-700 px-1 py-0.5 rounded mx-1">{'{{variable}}'}</code> syntax in URLs, headers, and body. Global vars are always available; active env overrides Global.
                </div>
            </div>
        </div>
    );
};
