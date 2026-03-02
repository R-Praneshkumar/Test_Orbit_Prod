/**
 * Lightweight toast notification store.
 * Import { toast } in any component to show notifications.
 * Import { useToastStore } in ToastContainer to render them.
 */
import { create } from 'zustand';

let toastId = 0;

export const useToastStore = create((set) => ({
    toasts: [],
    addToast: (message, type = 'info', duration = 4000) => {
        const id = ++toastId;
        set((state) => ({
            toasts: [...state.toasts.slice(-4), { id, message, type, duration }],
        }));
        return id;
    },
    removeToast: (id) =>
        set((state) => ({
            toasts: state.toasts.filter((t) => t.id !== id),
        })),
}));

/** Convenience helpers — import { toast } from '…/toast' */
export const toast = {
    success: (msg, ms) => useToastStore.getState().addToast(msg, 'success', ms),
    error: (msg, ms) => useToastStore.getState().addToast(msg, 'error', ms ?? 6000),
    info: (msg, ms) => useToastStore.getState().addToast(msg, 'info', ms),
    warn: (msg, ms) => useToastStore.getState().addToast(msg, 'warning', ms ?? 5000),
};
