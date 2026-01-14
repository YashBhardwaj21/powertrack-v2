
import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { PerformanceCharts } from '../components/PerformanceCharts';
import { ModelHealthPanel } from '../components/ModelHealthPanel';
import { StorageSystemStatus } from '../components/StorageSystemStatus';
import { FinancialAnalysis } from '../components/FinancialAnalysis';
import { GridAnalytics } from '../components/GridAnalytics';
import { CommunityEnergy } from '../components/CommunityEnergy';
import { LineChart, BarChart3, Loader2 } from 'lucide-react';

export const AnalyticsPage: React.FC = () => {
    const { data, loading } = useDashboard();

    if (loading || !data) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500"/></div>;

    return (
        <div className="animate-in fade-in duration-500">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">System Analytics & Reporting</h1>
                <p className="text-slate-500 mt-1 flex items-center gap-2">
                    <LineChart className="w-4 h-4" />
                    Deep dive into Technical Performance, Financial ROI, and Grid Interaction.
                </p>
            </div>

            {/* Section 1: Financial & Grid (The "Business" View) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                <FinancialAnalysis stats={data.financial_stats} />
                <div className="space-y-8">
                    <GridAnalytics currentData={data.current_data} schools={data.schools} />
                    <CommunityEnergy stats={data.community_stats} />
                </div>
            </div>

            {/* Section 2: Technical Performance (The "Engineer" View) */}
            <div className="mb-8">
                <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <BarChart3 className="text-blue-600" />
                    Technical Performance Analysis
                </h2>
                <PerformanceCharts 
                    currentData={data.current_data} 
                    historicalData={data.historical_data}
                    schools={data.schools}
                />
            </div>

            {/* Section 3: System Health & AI (The "Admin" View) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                 <ModelHealthPanel metrics={data.model_metrics} />
                 <StorageSystemStatus stats={data.storage_stats} />
            </div>
        </div>
    );
};
