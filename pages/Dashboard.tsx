
import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { StatsOverview } from '../components/StatsOverview';
import { LiveTelemetry } from '../components/LiveTelemetry';
import { SolarMap } from '../components/SolarMap';
import { AlertsPanel } from '../components/AlertsPanel';
import { Leaderboard } from '../components/Leaderboard';
import { ImpactSection } from '../components/ImpactSection';
import { Server, Loader2 } from 'lucide-react';

export const DashboardPage: React.FC = () => {
    const { data, lastUpdated, isConnected, loading } = useDashboard();

    if (loading || !data) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500"/></div>;

    return (
        <div className="animate-in fade-in duration-500">
            {/* Header / Meta */}
            <div className="flex flex-col sm:flex-row justify-between items-end mb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Operations Center</h1>
                    <p className="text-slate-500 mt-1 flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        Real-time Fleet Monitoring ({data.schools.length} Nodes)
                    </p>
                </div>
                <div className="text-right hidden sm:block">
                    <div className="flex items-center justify-end gap-2">
                        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`}></span>
                        <span className="text-xs font-mono text-slate-500 uppercase">
                            {isConnected ? 'Broker Connected' : 'Disconnected'}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1 font-mono">
                        LAST_PACKET: {lastUpdated || '--:--:--'}
                    </p>
                </div>
            </div>

            {/* Top Level Stats */}
            <StatsOverview data={data} />
            
            {/* Real-time Hardware View */}
            <div className="mb-8">
                <LiveTelemetry data={data.current_data} schools={data.schools} />
            </div>

            {/* Main Viz Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div className="lg:col-span-2 space-y-6">
                     <SolarMap schools={data.schools} currentData={data.current_data} />
                     <ImpactSection data={data} />
                </div>
                <div className="lg:col-span-1 space-y-6">
                     {/* Alerts & Incidents */}
                     <div className="h-[400px]">
                        <AlertsPanel alerts={data.alerts} />
                     </div>
                     <Leaderboard schools={data.schools} currentData={data.current_data} metadata={data.metadata} />
                </div>
            </div>
        </div>
    );
};
