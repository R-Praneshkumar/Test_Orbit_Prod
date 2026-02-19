import React, { useState } from 'react';
import { X, LogIn } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

const GuestBanner = () => {
    const user = useWorkspaceStore(state => state.user);
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);
    // Session-scoped dismissal — not persisted so banner re-shows after logout
    const [dismissed, setDismissed] = useState(false);

    if (user || dismissed) return null;

    const handleDismiss = () => {
        setDismissed(true);
    };

    return (
        <div className="bg-amber-50 dark:bg-amber-900/15 border-b border-amber-200 dark:border-amber-800/50 px-4 py-2 flex items-center justify-between gap-3 shrink-0">
            <p className="text-xs text-amber-700 dark:text-amber-300">
                You&apos;re in guest mode. Sign in to sync your data across devices.
            </p>
            <div className="flex items-center gap-2 shrink-0">
                <button
                    onClick={() => setCurrentView('login')}
                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium transition-colors"
                >
                    <LogIn size={12} />
                    Sign In
                </button>
                <button
                    onClick={handleDismiss}
                    className="text-amber-400 hover:text-amber-600 dark:hover:text-amber-200 transition-colors"
                >
                    <X size={14} />
                </button>
            </div>
        </div>
    );
};

export default GuestBanner;
