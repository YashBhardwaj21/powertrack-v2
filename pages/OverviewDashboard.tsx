import React, { useContext } from 'react';
import { AuthContext } from '../App';
import { useDashboard } from '../context/DashboardContext';
import { ControlRoom } from './ControlRoom';
import { StatsOverview } from '../components/StatsOverview';
import { SolarMap } from '../components/SolarMap';
import { Leaderboard } from '../components/Leaderboard';
import { DeviceWizard } from '../components/DeviceWizard';
import { Activity, Loader2, Building2 } from 'lucide-react';

import { formatLastUpdated } from '../utils/formatters';

export const OverviewDashboard: React.FC = () => {
    const auth = useContext(AuthContext);
    const { data, loading, error, status } = useDashboard();
    const isAdmin = auth?.user?.role === 'admin';

    if (status === 'loading') {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse uppercase tracking-[0.2em] text-[10px]">Initializing Command Center</p>
                </div>
            </div>
        );
    }

    // Auto-refresh for pending users
    // 🛑 REMOVED: Auto-refresh polling.
    // We rely on the 30s heartbeat or explicit reconciliation.
    // No more 5s polling loops.

    // Reactor: If status Says pending, but User Says Assigned -> Reload to reset Dashboard Context
    const { refresh } = useDashboard();
    const [showWizard, setShowWizard] = React.useState(false);
    const [isRegistering, setIsRegistering] = React.useState(false);

    // 🛡️ Explicit Reconciliation on Mount
    // If we land here and status is "needs_assignment", do ONE check of auth to be sure.
    React.useEffect(() => {
        if (status === 'needs_assignment') {
            auth?.refreshUser();
        }
    }, [status]); // Only run when status *changes* to needs_assignment

    if (isRegistering) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                    <p className="text-slate-900 font-bold text-lg">Provisioning Dashboard...</p>
                    <p className="text-slate-500 text-sm">Initializing reliable data streams</p>
                </div>
            </div>
        );
    }

    if (status === 'needs_assignment') {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
                <div className="bg-white border border-blue-200 p-8 rounded-2xl shadow-xl max-w-md text-center">
                    <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Building2 className="text-blue-600 w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">School Assignment Pending</h2>
                    <p className="text-slate-500 mb-6">Your account is active. Waiting for administrator assignment, or you can register a new organization node yourself.</p>

                    <button
                        onClick={() => setShowWizard(true)}
                        className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg shadow-slate-900/20 mb-4 flex items-center justify-center gap-2"
                    >
                        <Building2 className="w-4 h-4" /> Register New Organization
                    </button>

                    <div className="flex flex-col items-center gap-2">
                        <div className="text-xs font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                            Live Sync Active
                        </div>
                        <p className="text-[10px] text-slate-400">Checking for updates...</p>
                    </div>
                </div>

                {showWizard && (
                    <div className="fixed inset-0 z-[100]">
                        <DeviceWizard
                            onClose={() => setShowWizard(false)}
                            onComplete={async (schoolId, committedUser) => {
                                setShowWizard(false);
                                setIsRegistering(true); // 🔒 Lock UI

                                // 🏆 CONFIRMED COMMIT STRATEGY
                                // If we have the user object from the wizard (backend response),
                                // use it directly. DO NOT FETCH.
                                if (committedUser) {
                                    console.log('[Dashboard] Optimistic Commit: Updating user state directly');
                                    auth?.updateUser(committedUser);
                                } else {
                                    // Fallback only if absolutely necessary
                                    await auth?.refreshUser();
                                }

                                await refresh();
                                setIsRegistering(false); // 🔓 Unlock
                            }}
                        />
                    </div>
                )}
            </div>
        );
    }

    if (status === 'error' || error) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
                <div className="bg-white border border-red-200 p-8 rounded-2xl shadow-xl max-w-md text-center">
                    <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Activity className="text-red-600 w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">System Connectivity Issue</h2>
                    <p className="text-slate-500 mb-6">{error || 'Unable to establish a secure connection to the PowerTrack network.'}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="w-full py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-600/20"
                    >
                        Retry Connection
                    </button>
                </div>
            </div>
        );
    }

    // If data is still null after loading, it means there's no data to display,
    // which should ideally be covered by an error state or a specific empty state.
    // For now, we'll assume if we reach here, data is available.
    if (!data) {
        // This case should ideally not be reached if status covers all states,
        // but as a fallback, we can show a generic loader or error.
        return <div className="flex h-screen items-center justify-center bg-slate-50"><Loader2 className="animate-spin text-blue-600 w-12 h-12" /></div>;
    }

    // Determine latest update time from telemetry
    const currentData = data.current_data || [];
    const latestUpdate = currentData.length > 0
        ? currentData.reduce((max, d) => d.timestamp > max ? d.timestamp : max, currentData[0].timestamp)
        : new Date().toISOString();

    if (isAdmin) {
        return (
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* 1. Optimized Header Section */}
                <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">
                            Platform Command Center
                        </h1>
                        <p className="text-slate-500 text-xs mt-2 font-medium">
                            Nationwide school network • Managed nodes: <span className="text-slate-900 font-bold">{data.schools.length}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                                Sync: {formatLastUpdated(latestUpdate)}
                            </span>
                        </div>
                    </div>
                </header>

                {/* 2. KPI Section - High Density */}
                <StatsOverview data={data} />

                {/* 3. Map & Leaderboard Section - Height Compressed to 480px */}
                <div className="grid grid-cols-12 gap-6">
                    {/* Map Section - 8/12 width */}
                    <div className="col-span-12 lg:col-span-8 space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                                Live Geospatial Network
                            </h3>
                            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                                850 kWp Installed
                            </span>
                        </div>
                        <div className="h-[480px] w-full bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden relative group">
                            <SolarMap schools={data.schools} currentData={data.current_data} />
                            {data.schools.length === 0 && (
                                <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                                    <div className="text-center p-6 bg-white rounded-xl shadow-lg border border-slate-100">
                                        <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Awaiting school telemetry...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Leaderboard Section - 4/12 width */}
                    <div className="col-span-12 lg:col-span-4 space-y-3">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                            Global Leaderboard
                        </h3>
                        <div className="h-[480px] bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
                            <Leaderboard schools={data.schools} currentData={data.current_data} metadata={data.metadata} />
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // School User View
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">School Overview</h1>
                <p className="text-slate-500">Real-time telemetry and device status</p>
            </div>
            {/* Reuse ControlRoom stats logic for now */}
            <ControlRoom />
        </div>
    );
};