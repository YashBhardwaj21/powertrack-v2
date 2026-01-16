import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { DashboardProvider } from '../context/DashboardContext';

export const DashboardLayout: React.FC = () => {
    return (
        <DashboardProvider>
            <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-800 overflow-hidden">
                <Sidebar />
                <main className="flex-1 min-w-0 h-full overflow-y-auto">
                    <div className="max-w-[1440px] mx-auto p-6">
                        <Outlet />
                    </div>
                </main>
            </div>
        </DashboardProvider>
    );
};
