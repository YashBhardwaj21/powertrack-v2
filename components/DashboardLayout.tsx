import React from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { DashboardProvider } from '../context/DashboardContext';
import { Menu, Factory } from 'lucide-react';

export const DashboardLayout: React.FC = () => {
    const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

    return (
        <DashboardProvider>
            <div className="flex h-screen w-full bg-slate-50 font-sans text-slate-800 overflow-hidden">
                {/* Desktop Sidebar */}
                <div className="hidden md:flex h-full shrink-0">
                    <Sidebar />
                </div>

                {/* Mobile Sidebar Overlay */}
                {isSidebarOpen && (
                    <div className="fixed inset-0 z-50 md:hidden flex">
                        <div
                            className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
                            onClick={() => setIsSidebarOpen(false)}
                        />
                        <div className="relative w-64 h-full shadow-2xl animate-in slide-in-from-left duration-300">
                            <Sidebar onClose={() => setIsSidebarOpen(false)} />
                        </div>
                    </div>
                )}

                <main className="flex-1 min-w-0 h-full overflow-y-auto flex flex-col">
                    {/* Mobile Header */}
                    <header className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-40">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-600 p-1.5 rounded-lg">
                                <Factory className="text-white w-4 h-4" />
                            </div>
                            <span className="font-semibold text-slate-900">PowerTrack</span>
                        </div>
                        <button
                            onClick={() => setIsSidebarOpen(true)}
                            className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg lg:hidden"
                        >
                            <Menu className="w-5 h-5" />
                        </button>
                    </header>

                    <div className="max-w-[1440px] mx-auto p-4 md:p-6 w-full">
                        <Outlet />
                    </div>
                </main>
            </div>
        </DashboardProvider>
    );
};
