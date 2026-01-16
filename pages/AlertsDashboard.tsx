import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { AlertsPanel } from '../components/AlertsPanel';
import { ModelHealthPanel } from '../components/ModelHealthPanel';
import { Loader2 } from 'lucide-react';

export const AlertsDashboard: React.FC = () => {
    const { data, loading } = useDashboard();

    if (loading || !data) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">
                        System Health Center
                    </h1>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        Node monitoring: <span className="text-slate-900 font-bold">{data.schools.length} active</span> • Predictive diagnostics & logs
                    </p>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                    <span className="flex h-1.5 w-1.5 relative">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">System Nominal</span>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Left: Active Alerts & Health */}
                <div className="h-[480px]">
                    <AlertsPanel
                        alerts={data.alerts}
                        totalDevices={data.schools.length}
                        onlineDevices={data.current_data.length}
                    />
                </div>

                {/* Right: AI & Diagnostics */}
                {/* We wrap ModelHealthPanel to ensure consistent height matching if needed, 
                    or leave as flexible stack if ModelHealthPanel is variable height */}
                <div className="h-full">
                    <ModelHealthPanel metrics={data.model_metrics} />
                </div>
            </div>
        </div>
    );
};
