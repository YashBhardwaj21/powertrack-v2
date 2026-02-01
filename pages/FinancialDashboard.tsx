import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { Loader2 } from 'lucide-react';
import { FinancialOverview } from '../components/finance/FinancialOverview';
import { ValueBreakdownChart } from '../components/finance/ValueBreakdownChart';
import { RoiPaybackCard } from '../components/finance/RoiPaybackCard';
import { EnvironmentalImpactCard } from '../components/finance/EnvironmentalImpactCard';

export const FinancialDashboard: React.FC = () => {
    const { data, loading } = useDashboard();

    if (loading || !data) {
        return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500" /></div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
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

            {/* ---------- Key Metrics ---------- */}
            <section>
                <FinancialOverview data={data} />
            </section>

            {/* ---------- Deep Dive Grid ---------- */}
            <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Investment Breakdown */}
                <div className="xl:col-span-1 h-full">
                    <ValueBreakdownChart data={data} />
                </div>

                {/* ROI & Payback */}
                <div className="xl:col-span-1 h-full">
                    <RoiPaybackCard data={data} />
                </div>

                {/* ESG Impact */}
                <div className="xl:col-span-1 h-full">
                    <EnvironmentalImpactCard data={data} />
                </div>
            </section>
        </div>
    );
};
