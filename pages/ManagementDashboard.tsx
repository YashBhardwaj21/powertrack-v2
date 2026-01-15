
import React from 'react';
import { ControlRoom } from './ControlRoom'; // Temporarily using ControlRoom's add logic

export const ManagementDashboard: React.FC = () => {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">Platform Management</h1>
                <p className="text-slate-500">Onboard new schools and manage device keys</p>
            </div>

            {/* 
                TODO: Extract Add School logic from ControlRoom into a dedicated component 
                For now we render ControlRoom but we will strip stats from it later
            */}
            <ControlRoom />
        </div>
    );
};
