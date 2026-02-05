
import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { PerformanceCharts } from '../components/PerformanceCharts';

import { StorageSystemStatus } from '../components/StorageSystemStatus';

import { GridAnalytics } from '../components/GridAnalytics';
import { LineChart, BarChart3, Loader2 } from 'lucide-react';


export const Analytics: React.FC = () => {
    const { data, loading } = useDashboard();

    const schoolMap = React.useMemo(() => {
        if (!data?.schools) return {};
        return Object.fromEntries(data.schools.map(s => [s.id, s.name]));
    }, [data?.schools]);

    if (loading || !data) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>;

    return (
        <div className="animate-in fade-in duration-500 space-y-8">
            {/* ---------- Header ---------- */}
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">
                        Technical Performance Analysis
                    </h1>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        Real-time operational status and efficiency metrics for <span className="text-slate-900 font-bold">{data.schools.length} institutions</span>
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <div className="px-3 py-1">
                        <span className="text-xs font-bold text-slate-500">
                            {new Date().toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                        </span>
                    </div>
                </div>
            </header>



            {/* ---------- Section 1: Grid Analytics ---------- */}
            <section className="mb-6">
                <GridAnalytics
                    currentData={data.current_data}
                    historicalData={data.historical_data}
                    hourlyHistorical={data.hourly_historical}
                    schools={data.schools}
                />
            </section>

            {/* ---------- Section 2: Technical Performance (Backing Data) ---------- */}
            <section className="mb-6">
                <div className="flex items-center gap-3 mb-4 mt-8">
                    <div className="h-4 w-1 bg-blue-500 rounded-full" />
                    <h2 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                        Technical Performance Verification
                    </h2>
                </div>
                <PerformanceCharts
                    currentData={data.current_data}
                    historicalData={data.historical_data}
                    hourlyHistorical={data.hourly_historical}
                    dailyHistorical={data.daily_historical}
                    schools={data.schools}
                />
            </section>

            {/* ---------- Section 3: Backend System ---------- */}
            <section className="pb-12">
                <StorageSystemStatus stats={data.storage_stats} />
            </section>
        </div>
    );
};

