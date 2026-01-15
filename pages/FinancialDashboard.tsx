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
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Financial Impact</h1>
                <p className="text-slate-500">ROI analysis, savings tracking, and environmental benefits</p>
            </div>

            <div className="space-y-8">
                <FinancialAnalysis stats={data.financial_stats} />
                <ImpactSection data={data} />
            </div>
        </div>
    );
};
