import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { DashboardProvider } from '../context/DashboardContext';

export const DashboardLayout: React.FC = () => {
    return (
        <DashboardProvider>
            <div className="min-h-screen bg-slate-50 font-sans text-slate-800">
                <Sidebar />
                <main className="ml-64 p-8 transition-all duration-300 min-h-screen">
                    <div className="container mx-auto max-w-7xl">
                        <Outlet />
                    </div>
                </main>
            </div>
        </DashboardProvider>
    );
};
