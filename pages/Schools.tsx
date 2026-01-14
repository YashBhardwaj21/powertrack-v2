
import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import { SchoolList } from '../components/SchoolList';
import { Search, Loader2 } from 'lucide-react';

export const SchoolsPage: React.FC = () => {
    const { data, loading } = useDashboard();

    if (loading || !data) return <div className="flex justify-center p-12"><Loader2 className="animate-spin text-blue-500"/></div>;

    return (
        <div className="animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900 tracking-tight">School Network</h1>
                    <p className="text-slate-500 mt-1">Detailed status and specifications for all connected educational institutions.</p>
                </div>
                {/* Visual-only Search Bar */}
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                        type="text" 
                        placeholder="Search schools..." 
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                </div>
            </div>

            <SchoolList schools={data.schools} currentData={data.current_data} metadata={data.metadata} />
        </div>
    );
};
