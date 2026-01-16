import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { FinancialAnalysis } from '../components/FinancialAnalysis';
import { ImpactSection } from '../components/ImpactSection';
import { Loader2 } from 'lucide-react';

export const FinancialDashboard: React.FC = () => {
    const { data, loading } = useDashboard();

    if (loading || !data) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* ---------- Header ---------- */}
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">
                        Financial & Impact Overview
                    </h1>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        Detailed breakdown of investment recovery and environmental performance
                    </p>
                </div>
            </header>

            <div className="grid grid-cols-12 gap-6">
                {/* Investment Analysis - 7 Columns */}
                <div className="col-span-12 xl:col-span-7 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-4 w-1 bg-emerald-500 rounded-full" />
                        <h2 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                            Investment Analysis
                        </h2>
                    </div>
                    <FinancialAnalysis stats={data.financial_stats} />
                </div>

                {/* ESG Section - 5 Columns */}
                <div className="col-span-12 xl:col-span-5 space-y-4">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="h-4 w-1 bg-teal-500 rounded-full" />
                        <h2 className="text-[10px] font-bold text-slate-800 uppercase tracking-widest">
                            Environmental Impact
                        </h2>
                    </div>
                    <ImpactSection data={data} />
                </div>
            </div>
        </div>
    );
};
