
import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { PerformanceCharts } from '../components/PerformanceCharts';
import { ModelHealthPanel } from '../components/ModelHealthPanel';
import { StorageSystemStatus } from '../components/StorageSystemStatus';
import { FinancialAnalysis } from '../components/FinancialAnalysis';
import { GridAnalytics } from '../components/GridAnalytics';
import { CommunityEnergy } from '../components/CommunityEnergy';
import { LineChart, BarChart3, Loader2 } from 'lucide-react';

export const Analytics: React.FC = () => {
    const { data, loading } = useDashboard();

    if (loading || !data) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>;

    const schoolMap = React.useMemo(() => Object.fromEntries(data.schools.map(s => [s.id, s.name])), [data.schools]);

    return (
        <div className="animate-in fade-in duration-500 space-y-6">
            {/* ---------- Header ---------- */}
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">
                        Network Analytics
                    </h1>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        Deep-dive metrics for <span className="text-slate-900 font-bold">{data.schools.length} institutions</span> • Modeling grid interaction
                    </p>
                </div>

                <div className="flex items-center gap-4 bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 px-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Scope:</span>
                        <select className="text-xs font-bold border-none focus:ring-0 bg-transparent py-1 pr-8">
                            <option>All Representative Schools</option>
                            {data.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="w-px h-6 bg-slate-100" />
                    <div className="flex items-center gap-2 px-3">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Period:</span>
                        <select className="text-xs font-bold border-none focus:ring-0 bg-transparent py-1 pr-8">
                            <option>Last 7 Business Days</option>
                            <option>This Billing Cycle</option>
                            <option>Fiscal Year 2024</option>
                        </select>
                    </div>
                </div>
            </header>

            {/* ---------- Section 1: Economic Impact ---------- */}
            <section>
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-4 w-1 bg-emerald-500 rounded-full" />
                    <h2 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                        Economic Impact & CSR
                    </h2>
                </div>
                <div className="grid grid-cols-12 gap-6">
                    {/* Financial Main Card - 8 Columns */}
                    <div className="col-span-12 lg:col-span-8 min-h-[420px]">
                        <FinancialAnalysis stats={data.financial_stats} />
                    </div>
                    {/* Secondary Data - 4 Columns */}
                    <div className="col-span-12 lg:col-span-4 flex flex-col gap-6">
                        <CommunityEnergy stats={data.community_stats} />
                        <GridAnalytics
                            currentData={data.current_data}
                            historicalData={data.historical_data}
                            schools={data.schools}
                        />
                    </div>
                </div>
            </section>

            {/* ---------- Section 2: Generation Analytics ---------- */}
            <section>
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-4 w-1 bg-blue-500 rounded-full" />
                    <h2 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                        Technical Performance
                    </h2>
                </div>
                <PerformanceCharts
                    currentData={data.current_data}
                    historicalData={data.historical_data}
                    schools={data.schools}
                />
            </section>

            {/* ---------- Section 3: Technical Health ---------- */}
            <section className="pb-8">
                <div className="flex items-center gap-3 mb-4">
                    <div className="h-4 w-1 bg-slate-500 rounded-full" />
                    <h2 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                        Asset Health & Integrity
                    </h2>
                </div>
                <div className="grid grid-cols-12 gap-6">
                    <div className="col-span-12 lg:col-span-6">
                        <ModelHealthPanel metrics={data.model_metrics} />
                    </div>
                    <div className="col-span-12 lg:col-span-6">
                        <StorageSystemStatus stats={data.storage_stats} />
                    </div>
                </div>
            </section>
        </div>
    );
};
