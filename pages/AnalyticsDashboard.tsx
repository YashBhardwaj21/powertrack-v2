
import React from 'react';
import { Analytics } from './Analytics'; // Reusing the existing Analytics page for now

export const AnalyticsDashboard: React.FC = () => {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Historical Analytics</h1>
                <p className="text-slate-500">Deep dive into energy generation trends and efficiency</p>
            </div>

            <Analytics />
        </div>
    );
};
