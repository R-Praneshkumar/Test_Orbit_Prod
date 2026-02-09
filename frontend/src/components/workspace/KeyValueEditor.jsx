import React from 'react';
import { Trash2, Plus } from 'lucide-react';

export const KeyValueEditor = ({ items = [], onChange, placeholderKey = "Key", placeholderValue = "Value" }) => {

    // Ensure items is always an array
    const rows = Array.isArray(items) ? items : [];

    const updateRow = (index, field, value) => {
        const newRows = [...rows];
        newRows[index] = { ...newRows[index], [field]: value };
        onChange(newRows);
    };

    const addRow = () => {
        onChange([...rows, { key: '', value: '', enabled: true }]);
    };

    const deleteRow = (index) => {
        const newRows = rows.filter((_, i) => i !== index);
        onChange(newRows);
    };

    return (
        <div className="w-full font-sans">
            {/* Header */}
            <div className="flex bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <div className="w-8 py-2 text-center border-r border-slate-200 dark:border-slate-700"></div>
                <div className="flex-1 py-2 px-3 border-r border-slate-200 dark:border-slate-700">Key</div>
                <div className="flex-1 py-2 px-3 border-r border-slate-200 dark:border-slate-700">Value</div>
                <div className="w-10 py-2 text-center"></div>
            </div>

            {/* Rows */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map((row, index) => (
                    <div key={index} className="flex group bg-white dark:bg-slate-900 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors">
                        {/* Checkbox */}
                        <div className="w-8 flex items-center justify-center border-r border-slate-100 dark:border-slate-800 text-slate-300 dark:text-slate-600">
                            <input
                                type="checkbox"
                                checked={row.enabled !== false}
                                onChange={(e) => updateRow(index, 'enabled', e.target.checked)}
                                className="rounded border-slate-300 dark:border-slate-600 text-corporate-600 focus:ring-0 w-3 h-3 cursor-pointer"
                            />
                        </div>

                        {/* Key Input */}
                        <div className="flex-1 border-r border-slate-100 dark:border-slate-800 relative">
                            <input
                                type="text"
                                value={row.key}
                                onChange={(e) => updateRow(index, 'key', e.target.value)}
                                placeholder={placeholderKey}
                                className="w-full h-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono outline-none bg-transparent placeholder-slate-300 dark:placeholder-slate-600"
                            />
                        </div>

                        {/* Value Input */}
                        <div className="flex-1 border-r border-slate-100 dark:border-slate-800 relative">
                            <input
                                type="text"
                                value={row.value}
                                onChange={(e) => updateRow(index, 'value', e.target.value)}
                                placeholder={placeholderValue}
                                className="w-full h-full px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 font-mono outline-none bg-transparent placeholder-slate-300 dark:placeholder-slate-600"
                            />
                        </div>

                        {/* Delete Action */}
                        <div className="w-10 flex items-center justify-center">
                            <button
                                onClick={() => deleteRow(index)}
                                className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 text-slate-300 dark:text-slate-600 transition-all active:scale-95"
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer / Add New */}
            <button
                onClick={addRow}
                className="mt-2 ml-2 flex items-center gap-1 text-[10px] font-semibold text-slate-400 dark:text-slate-500 hover:text-corporate-600 dark:hover:text-corporate-400 px-2 py-1 rounded transition-colors"
            >
                <Plus size={12} />
                <span>Add Row</span>
            </button>
        </div>
    );
};
