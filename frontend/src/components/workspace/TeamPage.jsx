import React, { useState, useEffect, useCallback } from 'react';
import { Users, Plus, Trash2, UserPlus, Shield, Pencil, Eye, Crown, ArrowLeft, Settings, LogOut, ChevronDown, Folder, FileText, Globe, FolderPlus } from 'lucide-react';
import { supabase } from '../../utils/supabaseClient';
import { useWorkspaceStore, flattenItems } from '../../store/workspaceStore';
import { toast } from '../../utils/toast';

const ROLE_CONFIG = {
    owner: { label: 'Owner', icon: Crown, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20' },
    admin: { label: 'Admin', icon: Shield, color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-900/20' },
    editor: { label: 'Editor', icon: Pencil, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' },
    viewer: { label: 'Viewer', icon: Eye, color: 'text-slate-500 dark:text-slate-400', bg: 'bg-slate-50 dark:bg-slate-800' },
};

const PLAN_LIMITS = { free: 3, pro: 5, team: -1 };

function TeamPage() {
    const user = useWorkspaceStore(s => s.user);
    const setCurrentView = useWorkspaceStore(s => s.setCurrentView);
    const collections = useWorkspaceStore(s => s.collections);
    const addCollection = useWorkspaceStore(s => s.addCollection);
    const setActiveCollection = useWorkspaceStore(s => s.setActiveCollection);
    const environments = useWorkspaceStore(s => s.environments);

    const [teams, setTeams] = useState([]);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newTeamName, setNewTeamName] = useState('');
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState('editor');
    const [inviting, setInviting] = useState(false);
    const [activeTab, setActiveTab] = useState('members');
    const [showNewCollInput, setShowNewCollInput] = useState(false);
    const [newCollName, setNewCollName] = useState('');
    const [showNewEnvInput, setShowNewEnvInput] = useState(false);
    const [newEnvName, setNewEnvName] = useState('');

    const fetchTeams = useCallback(async () => {
        if (!supabase || !user) return;
        setLoading(true);
        // Fetch teams where user is a member (RLS handles visibility)
        const { data: memberRows } = await supabase
            .from('team_members')
            .select('team_id, role')
            .eq('user_email', user.email);

        if (!memberRows?.length) {
            setTeams([]);
            setLoading(false);
            return;
        }

        const teamIds = memberRows.map(m => m.team_id);
        const roleMap = Object.fromEntries(memberRows.map(m => [m.team_id, m.role]));

        const { data: teamRows } = await supabase
            .from('teams')
            .select('*')
            .in('id', teamIds)
            .order('created_at', { ascending: false });

        const enriched = (teamRows || []).map(t => ({ ...t, myRole: roleMap[t.id] || 'viewer' }));
        setTeams(enriched);
        setLoading(false);
    }, [user]);

    const fetchMembers = useCallback(async (teamId) => {
        if (!supabase) return;
        const { data } = await supabase
            .from('team_members')
            .select('*')
            .eq('team_id', teamId)
            .order('invited_at', { ascending: true });
        setMembers(data || []);
    }, []);

    useEffect(() => { fetchTeams(); }, [fetchTeams]);

    useEffect(() => {
        if (selectedTeam) fetchMembers(selectedTeam.id);
    }, [selectedTeam, fetchMembers]);

    const handleCreateTeam = async (e) => {
        e.preventDefault();
        if (!supabase || !user || !newTeamName.trim()) return;
        setCreating(true);
        try {
            const { data: team, error } = await supabase
                .from('teams')
                .insert({ name: newTeamName.trim(), owner_id: user.id })
                .select()
                .single();
            if (error) throw error;

            // Sync team plan with owner's subscription
            const subscription = useWorkspaceStore.getState().subscription;
            if (subscription?.plan === 'pro' || subscription?.plan === 'team') {
                const maxMembers = subscription.plan === 'team' ? 999 : 5;
                await supabase.from('teams').update({
                    plan: subscription.plan,
                    max_members: maxMembers,
                }).eq('id', team.id);
            }

            // Add creator as owner member
            const { error: memberErr } = await supabase
                .from('team_members')
                .insert({
                    team_id: team.id,
                    user_id: user.id,
                    user_email: user.email,
                    role: 'owner',
                    joined_at: new Date().toISOString(),
                });
            if (memberErr) throw memberErr;

            setNewTeamName('');
            toast.success(`Team "${team.name}" created`);
            await fetchTeams();
            setSelectedTeam({ ...team, myRole: 'owner' });
        } catch (err) {
            toast.error(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleInvite = async (e) => {
        e.preventDefault();
        if (!supabase || !selectedTeam || !inviteEmail.trim()) return;
        if (inviteEmail === user?.email) {
            toast.error("You can't invite yourself.");
            return;
        }
        setInviting(true);
        try {
            const { error } = await supabase
                .from('team_members')
                .insert({
                    team_id: selectedTeam.id,
                    user_email: inviteEmail.trim().toLowerCase(),
                    role: inviteRole,
                });
            if (error) throw error;
            toast.success(`Invited ${inviteEmail} as ${inviteRole}`);
            setInviteEmail('');
            fetchMembers(selectedTeam.id);
        } catch (err) {
            toast.error(err.message);
        } finally {
            setInviting(false);
        }
    };

    const handleRemoveMember = async (member) => {
        if (!supabase || !selectedTeam) return;
        if (member.role === 'owner') {
            toast.error("Cannot remove the team owner.");
            return;
        }
        try {
            const { error } = await supabase
                .from('team_members')
                .delete()
                .eq('id', member.id);
            if (error) throw error;
            toast.success(`Removed ${member.user_email}`);
            fetchMembers(selectedTeam.id);
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleChangeRole = async (member, newRole) => {
        if (!supabase) return;
        if (member.role === 'owner') {
            toast.error("Cannot change the owner's role. Transfer ownership first.");
            return;
        }
        try {
            const { error } = await supabase
                .from('team_members')
                .update({ role: newRole })
                .eq('id', member.id);
            if (error) throw error;
            toast.success(`${member.user_email} is now ${newRole}`);
            fetchMembers(selectedTeam.id);
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleLeaveTeam = async () => {
        if (!supabase || !selectedTeam || !user) return;
        if (selectedTeam.myRole === 'owner') {
            toast.error("Owners cannot leave. Transfer ownership or delete the team.");
            return;
        }
        try {
            const { error } = await supabase
                .from('team_members')
                .delete()
                .eq('team_id', selectedTeam.id)
                .eq('user_email', user.email);
            if (error) throw error;
            toast.success(`Left "${selectedTeam.name}"`);
            setSelectedTeam(null);
            fetchTeams();
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleDeleteTeam = async () => {
        if (!supabase || !selectedTeam) return;
        if (selectedTeam.myRole !== 'owner') {
            toast.error("Only the owner can delete a team.");
            return;
        }
        try {
            const { error } = await supabase
                .from('teams')
                .delete()
                .eq('id', selectedTeam.id);
            if (error) throw error;
            toast.success(`Deleted "${selectedTeam.name}"`);
            setSelectedTeam(null);
            fetchTeams();
        } catch (err) {
            toast.error(err.message);
        }
    };

    if (!user) {
        return (
            <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                    <Users size={48} className="mx-auto mb-4 text-slate-300 dark:text-slate-600" />
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-300 mb-2">Sign in to manage teams</h2>
                    <button onClick={() => setCurrentView('login')} className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors">
                        Sign In
                    </button>
                </div>
            </div>
        );
    }

    const myRole = selectedTeam?.myRole;
    const canManage = myRole === 'owner' || myRole === 'admin';
    const planLimit = PLAN_LIMITS[selectedTeam?.plan] ?? 3;
    const atLimit = planLimit > 0 && members.length >= planLimit;

    const handleCreateTeamCollection = () => {
        if (!newCollName.trim() || !selectedTeam) return;
        addCollection(newCollName.trim(), selectedTeam.id, selectedTeam.name);
        setNewCollName('');
        setShowNewCollInput(false);
        toast.success(`Collection "${newCollName.trim()}" created in ${selectedTeam.name}`);
    };

    const handleOpenTeamCollection = (colId) => {
        setActiveCollection(colId);
        setCurrentView('workspace');
    };

    const handleCreateTeamEnvironment = async () => {
        if (!newEnvName.trim() || !selectedTeam || !supabase || !user) return;
        const { environments: currentEnvs } = useWorkspaceStore.getState();
        // Check for duplicate name within team
        if (currentEnvs.some(e => e.name === newEnvName.trim() && e.team_id === selectedTeam.id)) {
            toast.error(`Environment "${newEnvName.trim()}" already exists in this team.`);
            return;
        }
        // Add to local store
        useWorkspaceStore.setState(s => ({
            environments: [...s.environments, { name: newEnvName.trim(), vars: [], team_id: selectedTeam.id }]
        }));
        // Save to Supabase
        await supabase.from('environments').upsert({
            owner_id: user.id,
            name: newEnvName.trim(),
            vars: [],
            team_id: selectedTeam.id,
            updated_at: new Date().toISOString()
        }, { onConflict: 'owner_id,name' });
        toast.success(`Environment "${newEnvName.trim()}" created`);
        setNewEnvName('');
        setShowNewEnvInput(false);
    };

    const teamCollections = selectedTeam ? collections.filter(c => c.team_id === selectedTeam.id) : [];
    const teamEnvs = selectedTeam ? environments.filter(e => e.team_id === selectedTeam.id) : [];

    // ── Team Detail View ────────────────────────────────────────
    if (selectedTeam) {
        const TABS = [
            { key: 'members', label: 'Members', icon: Users, count: members.length },
            { key: 'collections', label: 'Collections', icon: Folder, count: teamCollections.length },
            { key: 'environments', label: 'Environments', icon: Globe, count: teamEnvs.length },
        ];

        return (
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
                <div className="max-w-2xl mx-auto px-6 py-8">
                    {/* Back button */}
                    <button
                        onClick={() => { setSelectedTeam(null); setActiveTab('members'); }}
                        className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 mb-6 transition-colors"
                    >
                        <ArrowLeft size={14} /> All Teams
                    </button>

                    {/* Team header */}
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                    <Users size={22} className="text-corporate-500" />
                                    {selectedTeam.name}
                                </h1>
                                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 dark:text-slate-400">
                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold ${ROLE_CONFIG[myRole]?.bg} ${ROLE_CONFIG[myRole]?.color}`}>
                                        {React.createElement(ROLE_CONFIG[myRole]?.icon || Eye, { size: 10 })}
                                        {ROLE_CONFIG[myRole]?.label}
                                    </span>
                                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-medium capitalize">{selectedTeam.plan} plan</span>
                                    <span>{members.length}{planLimit > 0 ? `/${planLimit}` : ''} members</span>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {myRole !== 'owner' && (
                                    <button onClick={handleLeaveTeam} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors">
                                        <LogOut size={13} /> Leave
                                    </button>
                                )}
                                {myRole === 'owner' && (
                                    <button onClick={handleDeleteTeam} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors">
                                        <Trash2 size={13} /> Delete Team
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tab Navigation */}
                    <div className="flex gap-1 mb-6 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-1">
                        {TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg transition-colors ${activeTab === tab.key
                                    ? 'bg-corporate-50 dark:bg-corporate-900/30 text-corporate-700 dark:text-corporate-300'
                                    : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                                }`}
                            >
                                {React.createElement(tab.icon, { size: 13 })}
                                {tab.label}
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                    {tab.count}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* Members Tab */}
                    {activeTab === 'members' && (
                        <>
                            {/* Invite form (owner/admin only) */}
                            {canManage && (
                                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
                                    <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                                        <UserPlus size={15} /> Invite Member
                                    </h2>
                                    {atLimit ? (
                                        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs">
                                            <span className="text-amber-700 dark:text-amber-400">
                                                Team is at {members.length}/{planLimit} member limit ({selectedTeam.plan} plan).
                                            </span>
                                            <button
                                                onClick={() => setCurrentView('pricing')}
                                                className="flex items-center gap-1 font-bold text-purple-600 dark:text-purple-400"
                                            >
                                                <Crown size={12} /> Upgrade
                                            </button>
                                        </div>
                                    ) : (
                                        <form onSubmit={handleInvite} className="flex gap-2">
                                            <input
                                                type="email"
                                                required
                                                value={inviteEmail}
                                                onChange={e => setInviteEmail(e.target.value)}
                                                placeholder="colleague@example.com"
                                                className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-corporate-500 dark:text-slate-200"
                                            />
                                            <select
                                                value={inviteRole}
                                                onChange={e => setInviteRole(e.target.value)}
                                                className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none dark:text-slate-200"
                                            >
                                                <option value="viewer">Viewer</option>
                                                <option value="editor">Editor</option>
                                                <option value="admin">Admin</option>
                                            </select>
                                            <button
                                                type="submit"
                                                disabled={inviting}
                                                className="px-4 py-2 bg-corporate-600 hover:bg-corporate-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                                            >
                                                {inviting ? 'Inviting...' : 'Invite'}
                                            </button>
                                        </form>
                                    )}
                                </div>
                            )}

                            {/* Members list */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {members.map(member => {
                                        const rc = ROLE_CONFIG[member.role] || ROLE_CONFIG.viewer;
                                        const isSelf = member.user_email === user.email;
                                        return (
                                            <div key={member.id} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400">
                                                        {member.user_email.charAt(0).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                                            {member.user_email}
                                                            {isSelf && <span className="ml-1.5 text-[10px] text-slate-400">(you)</span>}
                                                        </div>
                                                        {!member.joined_at && (
                                                            <span className="text-[10px] text-amber-500 font-medium">Pending invite</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {canManage && member.role !== 'owner' && !isSelf ? (
                                                        <>
                                                            <div className="relative">
                                                                <select
                                                                    value={member.role}
                                                                    onChange={e => handleChangeRole(member, e.target.value)}
                                                                    className={`appearance-none pl-2 pr-6 py-1 text-xs font-semibold rounded-full border-0 cursor-pointer ${rc.bg} ${rc.color}`}
                                                                >
                                                                    <option value="viewer">Viewer</option>
                                                                    <option value="editor">Editor</option>
                                                                    <option value="admin">Admin</option>
                                                                </select>
                                                                <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
                                                            </div>
                                                            <button
                                                                onClick={() => handleRemoveMember(member)}
                                                                className="p-1 text-red-400 hover:text-red-600 transition-colors"
                                                                title="Remove member"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full ${rc.bg} ${rc.color}`}>
                                                            {React.createElement(rc.icon, { size: 10 })}
                                                            {rc.label}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                    {members.length === 0 && (
                                        <div className="px-6 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                                            No members yet. Invite your team above.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Collections Tab */}
                    {activeTab === 'collections' && (
                        <>
                            {/* New collection form */}
                            {(canManage || myRole === 'editor') && (
                                <div className="mb-4">
                                    {showNewCollInput ? (
                                        <div className="flex gap-2">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={newCollName}
                                                onChange={e => setNewCollName(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleCreateTeamCollection();
                                                    if (e.key === 'Escape') { setShowNewCollInput(false); setNewCollName(''); }
                                                }}
                                                placeholder="Collection name..."
                                                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-corporate-500 dark:text-slate-200"
                                            />
                                            <button
                                                onClick={handleCreateTeamCollection}
                                                disabled={!newCollName.trim()}
                                                className="px-4 py-2 bg-corporate-600 hover:bg-corporate-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Create
                                            </button>
                                            <button
                                                onClick={() => { setShowNewCollInput(false); setNewCollName(''); }}
                                                className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowNewCollInput(true)}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-corporate-600 hover:bg-corporate-700 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            <FolderPlus size={15} /> New Team Collection
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Team collections list */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {teamCollections.map(col => {
                                        const reqCount = flattenItems(col.items, 'request').length;
                                        return (
                                            <button
                                                key={col.id}
                                                onClick={() => handleOpenTeamCollection(col.id)}
                                                className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-left group"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <div className="w-9 h-9 bg-corporate-50 dark:bg-corporate-900/30 border border-corporate-200 dark:border-corporate-700 rounded-lg flex items-center justify-center">
                                                        <Folder size={18} className="text-corporate-600 dark:text-corporate-400" />
                                                    </div>
                                                    <div>
                                                        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100 group-hover:text-corporate-600 dark:group-hover:text-corporate-400 transition-colors">
                                                            {col.name}
                                                        </h3>
                                                        <span className="text-[11px] text-slate-400 dark:text-slate-500 flex items-center gap-1">
                                                            <FileText size={10} /> {reqCount} request{reqCount !== 1 ? 's' : ''}
                                                        </span>
                                                    </div>
                                                </div>
                                                <Settings size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
                                            </button>
                                        );
                                    })}
                                    {teamCollections.length === 0 && (
                                        <div className="px-6 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                                            No team collections yet. Create one to start collaborating.
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Environments Tab */}
                    {activeTab === 'environments' && (
                        <>
                            {/* New environment form */}
                            {(canManage || myRole === 'editor') && (
                                <div className="mb-4">
                                    {showNewEnvInput ? (
                                        <div className="flex gap-2">
                                            <input
                                                autoFocus
                                                type="text"
                                                value={newEnvName}
                                                onChange={e => setNewEnvName(e.target.value)}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') handleCreateTeamEnvironment();
                                                    if (e.key === 'Escape') { setShowNewEnvInput(false); setNewEnvName(''); }
                                                }}
                                                placeholder="Environment name (e.g., Staging)..."
                                                className="flex-1 px-3 py-2 text-sm bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-corporate-500 dark:text-slate-200"
                                            />
                                            <button
                                                onClick={handleCreateTeamEnvironment}
                                                disabled={!newEnvName.trim()}
                                                className="px-4 py-2 bg-corporate-600 hover:bg-corporate-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
                                            >
                                                Create
                                            </button>
                                            <button
                                                onClick={() => { setShowNewEnvInput(false); setNewEnvName(''); }}
                                                className="px-3 py-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => setShowNewEnvInput(true)}
                                            className="flex items-center gap-1.5 px-4 py-2 bg-corporate-600 hover:bg-corporate-700 text-white rounded-lg text-sm font-medium transition-colors"
                                        >
                                            <Plus size={15} /> New Team Environment
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* Team environments list */}
                            <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {teamEnvs.map(env => (
                                        <div
                                            key={env.name}
                                            className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-700 rounded-lg flex items-center justify-center">
                                                    <Globe size={18} className="text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <div>
                                                    <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{env.name}</h3>
                                                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                                                        {(env.vars || []).length} variable{(env.vars || []).length !== 1 ? 's' : ''}
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-corporate-50 dark:bg-corporate-900/20 text-corporate-600 dark:text-corporate-400">
                                                Team
                                            </span>
                                        </div>
                                    ))}
                                    {teamEnvs.length === 0 && (
                                        <div className="px-6 py-8 text-center text-sm text-slate-400 dark:text-slate-500">
                                            No team environments yet. Create one to share variables across your team.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <p className="mt-3 text-xs text-slate-400 dark:text-slate-500">
                                Team environments are shared with all team members and appear in the environment selector alongside personal environments.
                            </p>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // ── Team List View ──────────────────────────────────────────
    return (
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950">
            <div className="max-w-2xl mx-auto px-6 py-8">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <Users size={22} className="text-corporate-500" />
                        My Teams
                    </h1>
                </div>

                {/* Create team form */}
                <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-6 mb-6">
                    <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 mb-3">Create a New Team</h2>
                    <form onSubmit={handleCreateTeam} className="flex gap-2">
                        <input
                            type="text"
                            required
                            value={newTeamName}
                            onChange={e => setNewTeamName(e.target.value)}
                            placeholder="My API Team"
                            maxLength={100}
                            className="flex-1 px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:ring-2 focus:ring-corporate-500 dark:text-slate-200"
                        />
                        <button
                            type="submit"
                            disabled={creating || !supabase}
                            className="flex items-center gap-1.5 px-4 py-2 bg-corporate-600 hover:bg-corporate-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                        >
                            <Plus size={15} />
                            {creating ? 'Creating...' : 'Create Team'}
                        </button>
                    </form>
                    <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                        Free plan: up to 3 members per team. Pro: 5 members. Team plan: unlimited.
                    </p>
                </div>

                {/* Teams list */}
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : teams.length === 0 ? (
                    <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-12 text-center">
                        <Users size={40} className="mx-auto mb-3 text-slate-300 dark:text-slate-600" />
                        <h3 className="text-sm font-bold text-slate-600 dark:text-slate-400 mb-1">No teams yet</h3>
                        <p className="text-xs text-slate-400 dark:text-slate-500">Create your first team to start collaborating with your colleagues.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {teams.map(team => {
                            const rc = ROLE_CONFIG[team.myRole] || ROLE_CONFIG.viewer;
                            return (
                                <button
                                    key={team.id}
                                    onClick={() => setSelectedTeam(team)}
                                    className="w-full bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-5 text-left hover:border-corporate-300 dark:hover:border-corporate-700 hover:shadow-sm transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 group-hover:text-corporate-600 dark:group-hover:text-corporate-400 transition-colors">
                                                {team.name}
                                            </h3>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold rounded-full ${rc.bg} ${rc.color}`}>
                                                    {React.createElement(rc.icon, { size: 9 })}
                                                    {rc.label}
                                                </span>
                                                <span className="text-[10px] text-slate-400 capitalize">{team.plan} plan</span>
                                            </div>
                                        </div>
                                        <Settings size={16} className="text-slate-300 dark:text-slate-600 group-hover:text-slate-400 transition-colors" />
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}

export { TeamPage };
export default TeamPage;
