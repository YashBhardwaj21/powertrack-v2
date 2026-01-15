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
            <div>
                <h1 className="text-2xl font-bold text-slate-900">System Health & Alerts</h1>
                <p className="text-slate-500">Monitor active warnings and AI model diagnostics</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AlertsPanel alerts={data.alerts} />
                <ModelHealthPanel metrics={data.model_metrics} />
            </div>
        </div>
    );
};
