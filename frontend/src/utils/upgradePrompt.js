/**
 * Upgrade prompt mini-store (Zustand).
 * Triggers the upgrade modal when daily AI limits are hit (429 DAILY_LIMIT_EXCEEDED).
 * Kept separate from component file to satisfy ESLint react-refresh rule.
 */
import { create } from 'zustand';

export const useUpgradeStore = create((set) => ({
    visible: false,
    category: null,
    used: 0,
    limit: 0,
    message: '',
    show: ({ category, used, limit, message } = {}) =>
        set({ visible: true, category: category || 'ai_calls', used: used || 0, limit: limit || 0, message: message || '' }),
    hide: () => set({ visible: false }),
}));

/** Call from any component when a 429 DAILY_LIMIT_EXCEEDED is detected. */
export const showUpgradeModal = (info) => useUpgradeStore.getState().show(info);

/**
 * Check a fetch Response for 429 DAILY_LIMIT_EXCEEDED and auto-trigger the modal.
 * Returns true if the limit was hit (caller should stop processing).
 */
export async function checkLimitExceeded(res) {
    if (res.status !== 429) return false;
    try {
        const data = await res.clone().json();
        const detail = data.detail;
        if (detail && typeof detail === 'object' && detail.code === 'DAILY_LIMIT_EXCEEDED') {
            showUpgradeModal({
                category: detail.category,
                used: detail.used,
                limit: detail.limit,
                message: detail.message,
            });
            return true;
        }
    } catch {
        // Not a JSON limit response
    }
    return false;
}
