import React, { useContext } from 'react';
import { AuthContext } from '../App';
import { useDashboard } from '../context/DashboardContext';
import { ControlRoom } from './ControlRoom';
import { StatsOverview } from '../components/StatsOverview';
import { SolarMap } from '../components/SolarMap';
import { Leaderboard } from '../components/Leaderboard';
import { Loader2 } from 'lucide-react';

export const OverviewDashboard: React.FC = () => {
    const auth = useContext(AuthContext);
    const { data, loading } = useDashboard();
    const isAdmin = auth?.user?.role === 'admin';

    if (loading || !data) {
        return <div className="flex h-96 items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;
    }

    if (isAdmin) {
        return (
            <div className="space-y-8 animate-in fade-in duration-500">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Platform Command Center</h1>
                    <p className="text-slate-500">Global monitoring of all connected school installations</p>
                </div>

                <StatsOverview data={data} />

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2">
                        <SolarMap schools={data.schools} currentData={data.current_data} />
                    </div>
                    <div>
                        <Leaderboard schools={data.schools} currentData={data.current_data} metadata={data.metadata} />
                    </div>
                </div>
            </div>
        );
    }

    // School User View
    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div>
                <h1 className="text-2xl font-bold text-slate-900">School Overview</h1>
                <p className="text-slate-500">Real-time telemetry and device status</p>
            </div>
            {/* Reuse ControlRoom stats logic for now */}
            <ControlRoom />
        </div>
    );
};
