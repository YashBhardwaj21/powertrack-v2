import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import {
    Activity, Zap, Key, Cpu, Shield,
    Terminal, Loader2, Plus, X, Globe, Settings, ExternalLink, RefreshCw, Layers, Building2, Trash2, Archive, Users, CheckCircle2, AlertCircle, Search, LayoutGrid
} from 'lucide-react';
import { fetchSchoolLogs, fetchUsers, assignUserToSchool } from '../services/dataService';
import { DeviceWizard } from '../components/DeviceWizard';
import { useDashboard } from '../context/DashboardContext';
import { User } from '../types';
import { useToast } from '../context/ToastContext';

// Helper for archiving (Move to dataService in production)
const archiveSchool = async (id: string) => {
    const token = sessionStorage.getItem('auth_token');
    const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
    const res = await fetch(`${API_BASE}/schools/${id}`, {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        }
    });
    if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to archive organization');
    }
    return res.json();
};

export const ControlRoom: React.FC = () => {
    const auth = useContext(AuthContext);
    const { data, refresh } = useDashboard();
    const { showToast } = useToast();

    // Core State
    const [activeTab, setActiveTab] = useState<'network' | 'users'>('network');
    const [loading, setLoading] = useState(true);

    // Feature State: Network
    const [logs, setLogs] = useState<any[]>([]);
    const [showWizard, setShowWizard] = useState(false);
    const [archivingId, setArchivingId] = useState<string | null>(null);

    // Feature State: Users
    const [users, setUsers] = useState<User[]>([]);
    const [userSearch, setUserSearch] = useState('');
    const [userLoading, setUserLoading] = useState(false);

    // User Modal State
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [selectedSchoolId, setSelectedSchoolId] = useState<string>('');
    const [selectedRole, setSelectedRole] = useState<string>('school_admin');
    const [userSubmitting, setUserSubmitting] = useState(false);

    const isAdmin = auth?.user?.role === 'admin';

    // Initial Load - Network
    useEffect(() => {
        if (auth?.user?.school_id) {
            fetchSchoolLogs(auth.user.school_id).then(data => {
                setLogs(data);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [auth?.user?.school_id]);

    // Load Users when tab changes
    useEffect(() => {
        if (activeTab === 'users' && users.length === 0) {
            loadUsers();
        }
    }, [activeTab]);

    const loadUsers = async () => {
        setUserLoading(true);
        try {
            const userList = await fetchUsers();
            setUsers(userList);
        } catch (error) {
            console.error(error);
            showToast('Failed to load users', 'error');
        } finally {
            setUserLoading(false);
        }
    };

    // User Management Handlers
    const handleUserAssign = async () => {
        if (!selectedUser) return;

        setUserSubmitting(true);
        try {
            const schoolIdToSend = selectedSchoolId === 'none' ? null : selectedSchoolId;

            await assignUserToSchool(selectedUser.id, schoolIdToSend, selectedRole);
            showToast('User updated successfully', 'success');

            // Optimistic update
            setUsers(users.map(u => {
                if (u.id === selectedUser.id) {
                    const school = data?.schools.find(s => s.id === schoolIdToSend);
                    return {
                        ...u,
                        school_id: schoolIdToSend,
                        school_name: school ? school.name : undefined,
                        role: selectedRole as any
                    };
                }
                return u;
            }));

            setSelectedUser(null);
        } catch (error) {
            console.error(error);
            showToast('Failed to assign user', 'error');
        } finally {
            setUserSubmitting(false);
        }
    };

    const openUserModal = (user: User) => {
        setSelectedUser(user);
        setSelectedSchoolId(user.school_id || '');
        setSelectedRole(user.role);
    };

    // Network Handlers
    const getStatusInfo = (lastSeen: string | undefined) => {
        if (!lastSeen) return { color: 'bg-slate-300', text: 'NOT CONFIGURED', status: 'offline' };
        const diff = Date.now() - new Date(lastSeen).getTime();
        const minutes = diff / (1000 * 60);

        if (minutes < 5) return { color: 'bg-emerald-500', text: 'CONNECTED', status: 'online' };
        if (minutes < 60) return { color: 'bg-amber-500', text: 'NO DATA FLOW', status: 'standby' };
        return { color: 'bg-red-500', text: 'OFFLINE', status: 'offline' };
    };

    const handleArchive = async (id: string, name: string) => {
        if (!window.confirm(`Are you sure you want to archive "${name}"? It will be hidden from all dashboards but its data will be preserved.`)) return;

        setArchivingId(id);
        try {
            await archiveSchool(id);
            showToast('Organization archived successfully', 'success');

            // Refresh dashboard data to update all views including User Management
            await refresh();
        } catch (error) {
            console.error(error);
            showToast('Failed to archive organization', 'error');
        } finally {
            setArchivingId(null);
        }
    };

    // Filters
    const filteredUsers = users.filter(u =>
        u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
        u.full_name?.toLowerCase().includes(userSearch.toLowerCase())
    );

    const schoolList = isAdmin ? data?.schools : data?.schools.filter(s => s.id === auth?.user?.school_id);
    const lastTelemetry = (schoolId: string) => data?.current_data.find(d => d.school_id === schoolId);

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">
                        {isAdmin ? 'System Administration' : 'Center for Control & Admin'}
                    </h1>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        {isAdmin ? 'Global network management • User Provisioning • Data integrity' : 'Device lifecycle • Credential management • Network architecture'}
                    </p>
                </div>
                {isAdmin && (
                    <div className="flex gap-3">
                        {/* Moved to User Onboarding Flow
                        <button
                            onClick={() => setShowWizard(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm shadow-blue-200 transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                        >
                            <Plus className="w-4 h-4" /> Register New Org
                        </button>
                        */}
                    </div>
                )}
            </header>

            {/* Admin Tabs */}
            {isAdmin && (
                <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                    <button
                        onClick={() => setActiveTab('network')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'network' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <LayoutGrid className="w-4 h-4" /> Network
                    </button>
                    <button
                        onClick={() => setActiveTab('users')}
                        className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                            }`}
                    >
                        <Users className="w-4 h-4" /> User Management
                    </button>
                </div>
            )}

            {/* =========================================================
               TAB: NETWORK (Original Control Room)
               ========================================================= */}
            {activeTab === 'network' && (
                <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg"><Building2 className="w-5 h-5" /></div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">{isAdmin ? 'Registered Orgs' : 'Organization'}</span>
                                <span className="text-sm font-bold text-slate-800">
                                    {isAdmin ? `${data?.schools.length} Active` : (data?.schools.find(s => s.id === auth?.user?.school_id)?.name || 'Local Unit')}
                                </span>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg"><RefreshCw className="w-5 h-5" /></div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Last Sync Event</span>
                                <span className="text-sm font-bold text-slate-800">
                                    {data?.current_data[0] ? new Date(data.current_data[0].timestamp).toLocaleTimeString() : 'Never'}
                                </span>
                            </div>
                        </div>
                        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
                            <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg"><Layers className="w-5 h-5" /></div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Active Data Nodes</span>
                                <span className="text-sm font-bold text-slate-800">{data?.current_data.length} Registry</span>
                            </div>
                        </div>
                    </div>

                    {/* Developer Diagnostics */}
                    {isAdmin && (
                        <div className="bg-slate-900 rounded-xl p-6 border border-slate-800 shadow-2xl">
                            {/* ... (Keep existing diagnostic UI) ... */}
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <Terminal className="text-blue-400 w-5 h-5" />
                                    <h3 className="text-sm font-bold text-white uppercase tracking-widest leading-none">Ingestion Event Monitor</h3>
                                </div>
                                <div className="flex items-center gap-2 px-3 py-1 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">Live Diagnostics</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Last Payload</span>
                                    <span className="text-xs font-mono text-white">
                                        {data?.current_data[0] ? new Date(data.current_data[0].timestamp).toLocaleTimeString() : '---'}
                                    </span>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Drift Threshold</span>
                                    <span className="text-xs font-mono text-white">± 600s</span>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Backfill Flags</span>
                                    <span className="text-xs font-mono text-emerald-400">ACTIVE</span>
                                </div>
                                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700/50">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Mapping Policy</span>
                                    <span className="text-xs font-mono text-blue-400">STRICT</span>
                                </div>
                            </div>
                            <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-[11px]">
                                {data?.current_data.slice(0, 10).map((tel, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 hover:bg-slate-800 rounded transition-colors group">
                                        <div className="flex items-center gap-4">
                                            <span className="text-slate-600 w-20">{new Date(tel.timestamp).toLocaleTimeString()}</span>
                                            <span className="text-blue-400">INGEST</span>
                                            <span className="text-slate-400">ID: {tel.school_id.substring(0, 8)}</span>
                                            <span className="text-slate-500 group-hover:text-slate-300">Pwr: {tel.ac_power_kw}kW</span>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {tel.is_backfill && <span className="px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded text-[9px] font-bold tracking-tighter">BACKFILL</span>}
                                            {tel.is_suspect_time && <span className="px-1.5 py-0.5 bg-red-500/10 text-red-500 rounded text-[9px] font-bold tracking-tighter">SUSPECT_TS</span>}
                                            <span className="text-emerald-500 font-bold uppercase tracking-widest text-[9px]">OK</span>
                                        </div>
                                    </div>
                                ))}
                                {(!data?.current_data || data.current_data.length === 0) && (
                                    <div className="text-center py-4 text-slate-600 italic uppercase tracking-widest">Awaiting system events...</div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* School List Table */}
                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center">
                            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                                {isAdmin ? 'Global Organization Registry' : 'Your Connected Devices'}
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">{isAdmin ? 'Organization' : 'Device Name'}</th>
                                        <th className="px-6 py-4">District / Type</th>
                                        <th className="px-6 py-4">Capacity</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4">Last Seen</th>
                                        {isAdmin && <th className="px-6 py-4">Actions</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {schoolList?.map((s: any) => {
                                        const lt = lastTelemetry(s.id);
                                        const status = getStatusInfo(lt?.timestamp);
                                        return (
                                            <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                                                            {isAdmin ? <Building2 className="w-4 h-4" /> : <Cpu className="w-4 h-4" />}
                                                        </div>
                                                        <div>
                                                            <div className="text-sm font-bold text-slate-800">{s.name}</div>
                                                            <div className="text-[10px] text-slate-500 font-mono">{s.id.substring(0, 8)}...</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="text-xs font-bold text-slate-700">{s.district}</div>
                                                    <div className="text-[10px] text-slate-400 uppercase tracking-tighter">{s.type}</div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-blue-600">
                                                        {s.total_capacity_kwp} <span className="text-[10px]">kWP</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={`w-2 h-2 rounded-full ${status.color}`} />
                                                        <span className="text-xs font-bold text-slate-600">{status.text}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-slate-500 font-medium">
                                                    {lt ? new Date(lt.timestamp).toLocaleTimeString() : '---'}
                                                </td>
                                                {isAdmin && (
                                                    <td className="px-6 py-4">
                                                        <div className="flex gap-2">
                                                            <button className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-blue-600 transition-colors" title="Settings">
                                                                <Settings className="w-4 h-4" />
                                                            </button>
                                                            <button onClick={() => handleArchive(s.id, s.name)} disabled={archivingId === s.id} className="p-2 hover:bg-red-50 rounded-lg text-slate-300 hover:text-red-600 transition-colors disabled:opacity-50" title="Archive">
                                                                {archivingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    </td>
                                                )}
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* =========================================================
               TAB: USERS (New Integration)
               ========================================================= */}
            {activeTab === 'users' && (
                <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                    <div className="flex justify-between items-center bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">User Directory</h3>
                        <div className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
                            <Search className="w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search by email or name..."
                                className="bg-transparent text-sm outline-none w-64"
                                value={userSearch}
                                onChange={(e) => setUserSearch(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        {userLoading ? (
                            <div className="p-8 flex justify-center"><Loader2 className="animate-spin text-blue-600 w-8 h-8" /></div>
                        ) : (
                            <table className="w-full text-left">
                                <thead className="bg-slate-50 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    <tr>
                                        <th className="px-6 py-4">User Identity</th>
                                        <th className="px-6 py-4">Role</th>
                                        <th className="px-6 py-4">Assigned School</th>
                                        <th className="px-6 py-4">Status</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredUsers.map(user => (
                                        <tr key={user.id} className="hover:bg-slate-50 transition-colors group">
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                                                        <Users className="w-4 h-4" />
                                                    </div>
                                                    <div>
                                                        <div className="text-sm font-bold text-slate-900">{user.full_name || 'No Name'}</div>
                                                        <div className="text-xs text-slate-500 font-mono">{user.email}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    {user.role === 'admin' && <Shield className="w-3 h-3 text-purple-600" />}
                                                    <span className={`text-xs font-bold uppercase tracking-wider ${user.role === 'admin' ? 'text-purple-600' :
                                                        user.role === 'school_admin' ? 'text-blue-600' : 'text-slate-500'
                                                        }`}>
                                                        {user.role}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.school_id ? (
                                                    <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                                        <Building2 className="w-4 h-4 text-slate-400" />
                                                        {user.school_name || 'Unknown School'}
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-xs italic text-slate-400">
                                                        <AlertCircle className="w-3 h-3" /> Unassigned
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                {user.school_id || user.role === 'admin' ? (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-50 text-emerald-600 text-[10px] font-bold uppercase tracking-wider border border-emerald-100">
                                                        <CheckCircle2 className="w-3 h-3" /> Active
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 text-amber-600 text-[10px] font-bold uppercase tracking-wider border border-amber-100">
                                                        <AlertCircle className="w-3 h-3" /> Pending
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={() => openUserModal(user)}
                                                    className="text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors opacity-0 group-hover:opacity-100"
                                                >
                                                    Manage
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Ingestion Wizard Trigger */}
            {showWizard && (
                <DeviceWizard
                    onClose={() => setShowWizard(false)}
                    onComplete={async () => {
                        setShowWizard(false);

                        // Force complete refresh to show new school
                        console.log('[Wizard] Forcing dashboard refresh...');
                        await refresh();

                        // Reload users list if on users tab
                        if (activeTab === 'users') {
                            await loadUsers();
                        }
                    }}
                />
            )}

            {/* User Assignment Modal */}
            {selectedUser && (
                <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h3 className="font-bold text-slate-800">Assign School Access</h3>
                            <button onClick={() => setSelectedUser(null)} className="text-slate-400 hover:text-slate-600">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">User Account</label>
                                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-mono">
                                    {selectedUser.email}
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Role</label>
                                <select
                                    className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={selectedRole}
                                    onChange={(e) => setSelectedRole(e.target.value)}
                                >
                                    <option value="viewer">Viewer (Read Only)</option>
                                    <option value="school_admin">School Admin (Full Access)</option>
                                    {auth?.user?.role === 'admin' && <option value="admin">System Admin</option>}
                                </select>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Assigned School</label>
                                <select
                                    className="w-full p-3 bg-white border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    value={selectedSchoolId}
                                    onChange={(e) => setSelectedSchoolId(e.target.value)}
                                    disabled={selectedRole === 'admin'}
                                >
                                    <option value="">Select a school...</option>
                                    <option value="none" className="text-red-500 font-bold">-- Unassign (Revoke Access) --</option>
                                    {data?.schools.map(school => (
                                        <option key={school.id} value={school.id}>
                                            {school.name} ({school.total_capacity_kwp} kWp)
                                        </option>
                                    ))}
                                </select>
                                {selectedRole === 'admin' && (
                                    <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
                                        <AlertCircle className="w-3 h-3" /> System Admins have global access.
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                            <button onClick={() => setSelectedUser(null)} className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-800">
                                Cancel
                            </button>
                            <button
                                onClick={handleUserAssign}
                                disabled={userSubmitting || (selectedRole !== 'admin' && !selectedSchoolId)}
                                className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {userSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                                Commit Changes
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

