import React, { useState, useEffect } from 'react';
import { ArrowLeft, Save, LogOut, Shield, Github, Mail, Cloud, Lock, AlertTriangle } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { useWorkspaceStore } from '../../store/workspaceStore';

/**
 * Full-page profile management.
 * Rendered when currentView === 'profile'.
 */
const ProfilePage = () => {
    const user = useWorkspaceStore(state => state.user);
    const profile = useWorkspaceStore(state => state.profile);
    const collections = useWorkspaceStore(state => state.collections);
    const updateProfile = useWorkspaceStore(state => state.updateProfile);
    const logout = useWorkspaceStore(state => state.logout);
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);

    const [editName, setEditName] = useState('');
    const [editAvatar, setEditAvatar] = useState('');
    const [saving, setSaving] = useState(false);
    const [saveMsg, setSaveMsg] = useState(null);

    // Password change
    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordMsg, setPasswordMsg] = useState(null);

    useEffect(() => {
        if (profile) {
            setEditName(profile.full_name || '');
            setEditAvatar(profile.avatar_url || '');
        } else if (user) {
            setEditName(user.user_metadata?.full_name || '');
            setEditAvatar(user.user_metadata?.avatar_url || '');
        }
    }, [profile, user]);

    if (!user) {
        return (
            <div className="flex-1 flex items-center justify-center bg-slate-50 dark:bg-slate-950">
                <div className="text-center">
                    <p className="text-slate-500 dark:text-slate-400 mb-4">You need to sign in to view your profile.</p>
                    <button
                        onClick={() => setCurrentView('login')}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    const avatarUrl = editAvatar || user.user_metadata?.avatar_url;
    const displayName = editName || user.email?.split('@')[0] || 'User';
    const initial = (displayName[0] || 'U').toUpperCase();
    const memberSince = user.created_at
        ? new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
        : 'Unknown';

    // Determine connected providers
    const providers = user.app_metadata?.providers || [];
    const hasEmail = providers.includes('email');
    const hasGithub = providers.includes('github');
    const hasGoogle = providers.includes('google');

    const handleSaveProfile = async () => {
        setSaving(true);
        setSaveMsg(null);
        const { error } = await updateProfile({
            full_name: editName,
            avatar_url: editAvatar,
        });
        setSaving(false);
        setSaveMsg(error ? 'Failed to save.' : 'Profile updated.');
        setTimeout(() => setSaveMsg(null), 3000);
    };

    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPasswordLoading(true);
        setPasswordMsg(null);
        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;
            setPasswordMsg('Password updated successfully.');
            setNewPassword('');
            setShowPasswordForm(false);
        } catch (err) {
            setPasswordMsg(err.message);
        } finally {
            setPasswordLoading(false);
            setTimeout(() => setPasswordMsg(null), 4000);
        }
    };

    const handleLogout = async () => {
        await logout();
        setCurrentView('login');
    };

    const handleLogoutAll = async () => {
        if (!supabase) return;
        try {
            await supabase.auth.signOut({ scope: 'global' });
        } catch { /* ignore */ }
        setCurrentView('login');
    };

    return (
        <div className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-950">
            <div className="max-w-2xl mx-auto px-6 py-8">
                {/* Back button */}
                <button
                    onClick={() => setCurrentView('dashboard')}
                    className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 mb-6 transition-colors"
                >
                    <ArrowLeft size={16} />
                    Back to Dashboard
                </button>

                {/* Profile Header */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-5">
                    <div className="flex items-center gap-5">
                        {/* Avatar */}
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt="Avatar"
                                className="w-16 h-16 rounded-full object-cover border-2 border-purple-200 dark:border-purple-800"
                            />
                        ) : (
                            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white text-2xl font-bold border-2 border-purple-200 dark:border-purple-800">
                                {initial}
                            </div>
                        )}

                        <div className="flex-1 min-w-0">
                            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
                                {displayName}
                            </h1>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                                {user.email}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                                Member since {memberSince}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Account Information */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-5">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Account Information</h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Full Name</label>
                            <input
                                type="text"
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all text-slate-900 dark:text-slate-100"
                                placeholder="Your name"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Email</label>
                            <input
                                type="email"
                                value={user.email || ''}
                                disabled
                                className="w-full px-3 py-2 text-sm bg-slate-100 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5">Avatar URL</label>
                            <input
                                type="url"
                                value={editAvatar}
                                onChange={(e) => setEditAvatar(e.target.value)}
                                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-purple-500/40 focus:border-purple-500 transition-all text-slate-900 dark:text-slate-100"
                                placeholder="https://example.com/avatar.jpg"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleSaveProfile}
                                disabled={saving}
                                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                            >
                                <Save size={14} />
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                            {saveMsg && (
                                <span className={`text-xs ${saveMsg.includes('Failed') ? 'text-red-500' : 'text-green-500'}`}>
                                    {saveMsg}
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Connected Providers */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-5">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Connected Accounts</h2>
                    <div className="flex flex-wrap gap-2">
                        {hasGoogle && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-full text-xs font-medium">
                                <svg width="14" height="14" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                Google
                            </span>
                        )}
                        {hasGithub && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium">
                                <Github size={14} />
                                GitHub
                            </span>
                        )}
                        {hasEmail && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-full text-xs font-medium">
                                <Mail size={14} />
                                Email
                            </span>
                        )}
                        {!hasGoogle && !hasGithub && !hasEmail && (
                            <p className="text-xs text-slate-400">No connected providers found.</p>
                        )}
                    </div>
                </div>

                {/* Sync Status */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-5">
                    <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-4">Sync Status</h2>
                    <div className="flex items-center gap-3">
                        <Cloud size={18} className="text-green-500" />
                        <div>
                            <div className="flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-sm font-medium text-green-600 dark:text-green-400">Active & Synced</span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {collections.length} collection{collections.length !== 1 ? 's' : ''} synced to cloud
                            </p>
                        </div>
                    </div>
                </div>

                {/* Danger Zone */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-red-200 dark:border-red-900/50 p-6">
                    <h2 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-4 flex items-center gap-2">
                        <AlertTriangle size={16} />
                        Danger Zone
                    </h2>

                    <div className="space-y-3">
                        {/* Change Password */}
                        {!showPasswordForm ? (
                            <button
                                onClick={() => setShowPasswordForm(true)}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                            >
                                <Lock size={14} />
                                Change Password
                            </button>
                        ) : (
                            <form onSubmit={handleChangePassword} className="p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">New Password</label>
                                    <input
                                        type="password"
                                        value={newPassword}
                                        onChange={(e) => setNewPassword(e.target.value)}
                                        minLength={6}
                                        required
                                        className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-purple-500/40 text-slate-900 dark:text-slate-100"
                                        placeholder="Min. 6 characters"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button
                                        type="submit"
                                        disabled={passwordLoading}
                                        className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                                    >
                                        {passwordLoading ? 'Updating...' : 'Update Password'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowPasswordForm(false); setNewPassword(''); }}
                                        className="px-3 py-1.5 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-xs font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                                {passwordMsg && (
                                    <p className={`text-xs ${passwordMsg.includes('success') ? 'text-green-500' : 'text-red-500'}`}>
                                        {passwordMsg}
                                    </p>
                                )}
                            </form>
                        )}

                        {/* Sign Out */}
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors w-full"
                        >
                            <LogOut size={14} />
                            Sign Out
                        </button>

                        {/* Sign Out Everywhere */}
                        <button
                            onClick={handleLogoutAll}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors w-full"
                        >
                            <Shield size={14} />
                            Sign Out of All Devices
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProfilePage;
