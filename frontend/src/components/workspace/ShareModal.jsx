import React, { useState, useEffect } from 'react';
import { X, Users, Trash2, UserPlus, Shield, Pencil, Crown, ArrowRight } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { useWorkspaceStore } from '../../store/workspaceStore';

// Free tier: owner + 2 collaborators = 3 total users per collection
const FREE_TIER_MAX_COLLABORATORS = 2;

const ShareModal = ({ isOpen, onClose, collectionId, collectionName }) => {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState('viewer');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [shares, setShares] = useState([]);
    const [loadingShares, setLoadingShares] = useState(false);
    const user = useWorkspaceStore(state => state.user);
    const subscription = useWorkspaceStore(state => state.subscription);
    const setCurrentView = useWorkspaceStore(state => state.setCurrentView);
    const isFree = subscription?.plan === 'free';
    const atLimit = isFree && shares.length >= FREE_TIER_MAX_COLLABORATORS;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (isOpen && collectionId) fetchShares(); }, [isOpen, collectionId]);

    const fetchShares = async () => {
        if (!supabase || !collectionId) return;
        setLoadingShares(true);
        const { data, error } = await supabase
            .from('collection_shares')
            .select('*')
            .eq('collection_id', collectionId)
            .order('created_at', { ascending: true });

        if (!error && data) {
            setShares(data);
        }
        setLoadingShares(false);
    };

    if (!isOpen) return null;

    const handleInvite = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        if (!supabase) {
            setMessage({ type: 'error', text: 'Supabase not configured.' });
            setLoading(false);
            return;
        }

        if (email === user?.email) {
            setMessage({ type: 'error', text: "You can't share with yourself." });
            setLoading(false);
            return;
        }

        // Free tier: max 2 collaborators per collection (check if this is a new invite, not an update)
        const isNewInvite = !shares.some(s => s.user_email === email);
        if (isFree && isNewInvite && shares.length >= FREE_TIER_MAX_COLLABORATORS) {
            setMessage({ type: 'error', text: `Free plan allows up to ${FREE_TIER_MAX_COLLABORATORS} collaborators per collection. Upgrade to Pro for unlimited sharing.` });
            setLoading(false);
            return;
        }

        try {
            // Ensure the collection exists in Supabase (it's stored locally, but shares need it in the DB)
            const col = useWorkspaceStore.getState().collections.find(c => c.id === collectionId);
            const effectiveOwnerId = col?.owner_id || user?.id;
            const { error: syncError } = await supabase
                .from('collections')
                .upsert({
                    id: collectionId,
                    name: collectionName || 'Untitled',
                    owner_id: effectiveOwnerId,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'id' });

            if (syncError) {
                console.warn('Collection sync warning:', syncError.message);
                // Try insert if upsert fails (no unique constraint edge case)
                const { error: insertErr } = await supabase
                    .from('collections')
                    .insert({
                        id: collectionId,
                        name: collectionName || 'Untitled',
                        owner_id: effectiveOwnerId
                    });
                if (insertErr && !insertErr.message.includes('duplicate')) {
                    throw new Error(`Could not sync collection: ${insertErr.message}`);
                }
            }

            // Check if this email already has a share for this collection
            const { data: existing } = await supabase
                .from('collection_shares')
                .select('id')
                .eq('collection_id', collectionId)
                .eq('user_email', email)
                .maybeSingle();

            let error;
            if (existing) {
                // Update existing share role
                ({ error } = await supabase
                    .from('collection_shares')
                    .update({ role })
                    .eq('id', existing.id));
            } else {
                // Insert new share
                ({ error } = await supabase
                    .from('collection_shares')
                    .insert({
                        collection_id: collectionId,
                        user_email: email,
                        role: role
                    }));
            }

            if (error) throw error;

            setMessage({ type: 'success', text: `Invited ${email} as ${role}` });
            setEmail('');
            fetchShares();
        } catch (err) {
            setMessage({ type: 'error', text: err.message });
        } finally {
            setLoading(false);
        }
    };

    const handleRemoveShare = async (shareId) => {
        if (!supabase) return;
        await supabase.from('collection_shares').delete().eq('id', shareId);
        fetchShares();
    };

    const roleIcon = (r) => r === 'editor'
        ? <Pencil size={12} className="text-amber-500" />
        : <Shield size={12} className="text-blue-500" />;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-800 overflow-hidden">
                <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-800">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Users size={20} className="text-corporate-500" />
                        Share "{collectionName}"
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                        <X size={20} />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Free tier limit indicator */}
                    {isFree && (
                        <div className={`flex items-center justify-between p-3 rounded-lg text-xs ${
                            atLimit
                                ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800'
                                : 'bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700'
                        }`}>
                            <div className="flex items-center gap-2">
                                <Users size={14} className={atLimit ? 'text-amber-500' : 'text-slate-400'} />
                                <span className={atLimit ? 'text-amber-700 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}>
                                    {shares.length}/{FREE_TIER_MAX_COLLABORATORS} collaborators
                                    <span className="text-slate-400 dark:text-slate-500 ml-1">(free plan)</span>
                                </span>
                            </div>
                            {atLimit && (
                                <button
                                    onClick={() => { onClose(); setCurrentView('pricing'); }}
                                    className="flex items-center gap-1 text-xs font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
                                >
                                    <Crown size={12} /> Upgrade
                                </button>
                            )}
                        </div>
                    )}

                    <form onSubmit={handleInvite} className="space-y-4">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Invite Collaborator</label>
                            <div className="flex gap-2">
                                <input
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    disabled={atLimit}
                                    className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-corporate-500 transition-all dark:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                                    placeholder={atLimit ? 'Upgrade to add more collaborators' : 'colleague@example.com'}
                                />
                                <select
                                    value={role}
                                    onChange={(e) => setRole(e.target.value)}
                                    disabled={atLimit}
                                    className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-corporate-500 dark:text-slate-200 disabled:opacity-50"
                                >
                                    <option value="viewer">Viewer</option>
                                    <option value="editor">Editor</option>
                                </select>
                            </div>
                        </div>

                        {message && (
                            <div className={`p-3 rounded-lg text-xs ${message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                                {message.text}
                            </div>
                        )}

                        {atLimit ? (
                            <button
                                type="button"
                                onClick={() => { onClose(); setCurrentView('pricing'); }}
                                className="w-full py-2 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
                            >
                                <Crown size={16} />
                                Upgrade to Pro — Unlimited Collaborators
                                <ArrowRight size={14} />
                            </button>
                        ) : (
                            <button
                                type="submit"
                                disabled={loading || !supabase}
                                className="w-full py-2 bg-corporate-600 hover:bg-corporate-700 text-white rounded-lg font-medium text-sm transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <UserPlus size={16} />
                                {loading ? 'Sending...' : 'Send Invite'}
                            </button>
                        )}
                    </form>

                    <div>
                        <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">Who has access</h3>
                        <div className="space-y-2 max-h-48 overflow-y-auto">
                            {/* Owner */}
                            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800/50">
                                <div className="flex items-center gap-2">
                                    <div className="w-7 h-7 rounded-full bg-corporate-100 dark:bg-corporate-900/30 flex items-center justify-center text-corporate-600 dark:text-corporate-400 text-xs font-bold">
                                        {user?.email?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{user?.email}</div>
                                    </div>
                                </div>
                                <span className="text-xs text-corporate-600 dark:text-corporate-400 font-semibold px-2 py-0.5 bg-corporate-50 dark:bg-corporate-900/20 rounded-full">Owner</span>
                            </div>

                            {/* Shared Users */}
                            {loadingShares ? (
                                <div className="text-xs text-slate-400 text-center py-2">Loading...</div>
                            ) : shares.length === 0 ? (
                                <div className="text-xs text-slate-400 text-center py-2">No collaborators yet</div>
                            ) : shares.map(share => (
                                <div key={share.id} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 text-xs font-bold">
                                            {share.user_email.charAt(0).toUpperCase()}
                                        </div>
                                        <div>
                                            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{share.user_email}</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="flex items-center gap-1 text-xs text-slate-500 capitalize">
                                            {roleIcon(share.role)} {share.role}
                                        </span>
                                        <button
                                            onClick={() => handleRemoveShare(share.id)}
                                            className="text-red-400 hover:text-red-600 transition-colors"
                                            title="Remove access"
                                        >
                                            <Trash2 size={14} />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ShareModal;
