import React, { useContext } from 'react';
import { AuthContext } from '../App';
import { useDashboard } from '../context/DashboardContext';
import { ControlRoom } from './ControlRoom';
import { StatsOverview } from '../components/StatsOverview';
import { SolarMap } from '../components/SolarMap';
import { Leaderboard } from '../components/Leaderboard';
import { Activity, Loader2 } from 'lucide-react';

import { formatLastUpdated } from '../utils/formatters';

export const OverviewDashboard: React.FC = () => {
    const auth = useContext(AuthContext);
    const { data, loading, error } = useDashboard();
    const isAdmin = auth?.user?.role === 'admin';

    if (error) {
        return (
            <div className="flex h-screen items-center justify-center bg-slate-50 p-4">
                <div className="bg-white border border-red-200 p-8 rounded-2xl shadow-xl max-w-md text-center">
                    <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                        <Activity className="text-red-600 w-8 h-8" />
                    </div>
                    <h2 className="text-xl font-bold text-slate-900 mb-2">System Error</h2>
                    <p className="text-slate-500 mb-6">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-6 rounded-lg transition-colors"
                    >
                        Try Refreshing
                    </button>
                </div>
            </div>
        );
    }

    if (loading || !data) {
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