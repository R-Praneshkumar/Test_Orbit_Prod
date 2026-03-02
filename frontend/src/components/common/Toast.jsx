import React, { useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { useToastStore } from '../../utils/toast';

function ToastItem({ id, message, type, duration }) {
    const removeToast = useToastStore((s) => s.removeToast);

    useEffect(() => {
        const timer = setTimeout(() => removeToast(id), duration);
        return () => clearTimeout(timer);
    }, [id, duration, removeToast]);

    const icons = {
        success: <CheckCircle size={14} className="text-emerald-500 shrink-0" />,
        error: <AlertCircle size={14} className="text-red-500 shrink-0" />,
        warning: <AlertCircle size={14} className="text-amber-500 shrink-0" />,
        info: <Info size={14} className="text-blue-500 shrink-0" />,
    };

    const borders = {
        success: 'border-emerald-200 dark:border-emerald-800',
        error: 'border-red-200 dark:border-red-800',
        warning: 'border-amber-200 dark:border-amber-800',
        info: 'border-blue-200 dark:border-blue-800',
    };

    return (
        <div
            className={`flex items-start gap-2 px-3 py-2.5 rounded-lg border shadow-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs max-w-sm animate-slide-in ${borders[type] || borders.info}`}
            role="alert"
        >
            {icons[type] || icons.info}
            <span className="flex-1 leading-relaxed">{message}</span>
            <button
                onClick={() => removeToast(id)}
                className="p-0.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 shrink-0"
            >
                <X size={12} />
            </button>
        </div>
    );
}

export function ToastContainer() {
    const toasts = useToastStore((s) => s.toasts);
    if (!toasts.length) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
            {toasts.map((t) => (
                <ToastItem key={t.id} {...t} />
            ))}
        </div>
    );
}
