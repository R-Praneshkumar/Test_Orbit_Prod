import React, { useState, useRef, useEffect } from 'react';
import { LogOut, User, ChevronDown, Sparkles, Crown, Users, Shield } from 'lucide-react';
import { useWorkspaceStore } from '../../store/workspaceStore';

/**
 * Header auth UI component.
 * - Logged out: styled "Sign In" button
 * - Logged in: avatar circle with dropdown (profile, sign out)
 */
const UserMenu = () => {
    const user = useWorkspaceStore(state => state.user);
    const profile = useWorkspaceStore(state => state.profile);
    const logout = useWorkspaceStore(state => state.logout);
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);
    const subscription = useWorkspaceStore(state => state.subscription);
    const isAdmin = useWorkspaceStore(state => state.isAdmin);

    const [open, setOpen] = useState(false);
    const menuRef = useRef(null);

    // Close on outside click or Escape
    useEffect(() => {
        if (!open) return;
        const handleClick = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false);
        };
        const handleKey = (e) => {
            if (e.key === 'Escape') setOpen(false);
        };
        document.addEventListener('mousedown', handleClick);
        document.addEventListener('keydown', handleKey);
        return () => {
            document.removeEventListener('mousedown', handleClick);
            document.removeEventListener('keydown', handleKey);
        };
    }, [open]);

    // Logged out: Sign In button
    if (!user) {
        return (
            <button
                onClick={() => setCurrentView('login')}
                className="flex items-center gap-1.5 px-3.5 py-1.5 bg-corporate-600 hover:bg-corporate-700 text-white rounded-lg text-xs font-semibold transition-colors shadow-sm"
            >
                Sign In
            </button>
        );
    }

    // Logged in: avatar + dropdown
    const avatarUrl = profile?.avatar_url || user.user_metadata?.avatar_url;
    const displayName = profile?.full_name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'User';
    const initial = (displayName[0] || 'U').toUpperCase();

    const handleLogout = async () => {
        setOpen(false);
        await logout();
        setCurrentView('login');
    };

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setOpen(!open)}
                className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label="User menu"
            >
                {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover" />
                ) : (
                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-corporate-500 to-corporate-700 flex items-center justify-center text-white text-xs font-bold">
                        {initial}
                    </div>
                )}
                <span className="text-xs font-medium text-slate-700 dark:text-slate-300 hidden sm:flex items-center gap-1.5 max-w-[140px]">
                    <span className="truncate">{displayName}</span>
                    {subscription?.plan !== 'free' && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shrink-0">
                            PRO
                        </span>
                    )}
                </span>
                <ChevronDown size={12} className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 z-50 overflow-hidden">
                    {/* User info + plan badge */}
                    <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center justify-between mb-0.5">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{displayName}</p>
                            {subscription?.plan === 'free' ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">Free</span>
                            ) : (
                                <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                                    <Crown size={9} /> Pro
                                </span>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                    </div>

                    {/* Actions */}
                    <div className="py-1">
                        <button
                            onClick={() => { setOpen(false); setCurrentView('profile'); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <User size={15} className="text-slate-400" />
                            Profile & Settings
                        </button>
                        <button
                            onClick={() => { setOpen(false); setCurrentView('team'); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            <Users size={15} className="text-slate-400" />
                            My Teams
                        </button>
                        {isAdmin && (
                            <button
                                onClick={() => { setOpen(false); setCurrentView('admin'); }}
                                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <Shield size={15} className="text-slate-400" />
                                Admin Dashboard
                            </button>
                        )}
                        <button
                            onClick={() => { setOpen(false); setCurrentView('pricing'); }}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-corporate-600 dark:text-corporate-400 hover:bg-corporate-50 dark:hover:bg-corporate-900/10 transition-colors"
                        >
                            <Sparkles size={15} />
                            {subscription?.plan === 'free' ? 'Upgrade to Pro' : 'Manage Subscription'}
                        </button>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 py-1">
                        <button
                            onClick={handleLogout}
                            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                        >
                            <LogOut size={15} />
                            Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserMenu;
