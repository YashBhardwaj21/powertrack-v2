import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { HistoricalData, Telemetry, School } from '../types';
import { Zap, Home, ArrowRightLeft, Clock, ZoomIn } from 'lucide-react';
import { EmptyState } from './ui/EmptyState';
import { useDashboard } from '../context/DashboardContext';
import { formatTimeInSchoolTZ } from '../utils/timezone';

interface GridAnalyticsProps {
    currentData: Telemetry[];
    historicalData: HistoricalData[]; // Daily data (legacy name)
    hourlyHistorical?: Array<{ hour: string; avg_power: number; energy: number; avg_load: number; avg_import: number; avg_export: number }>; // Hourly data (correct source)
    schools: School[];
    timezone?: string; // School's IANA timezone
}

export const GridAnalytics: React.FC<GridAnalyticsProps> = ({ currentData, historicalData, hourlyHistorical, schools, timezone = 'UTC' }) => {
    const { granularity, setGranularity, loading } = useDashboard();

    // Aggregated current snapshot from REAL telemetry
    const totalSolar = currentData.reduce((acc, curr) => acc + (Number(curr.ac_power_kw) || 0), 0);
    const totalLoad = currentData.reduce((acc, curr) => acc + (Number(curr.load_kw) || 0), 0);
    const totalExport = currentData.reduce((acc, curr) => acc + (Number(curr.grid_export_kw) || 0), 0);
    const totalImport = currentData.reduce((acc, curr) => acc + (Number(curr.grid_import_kw) || 0), 0);

    // Prefer hourlyHistorical for 24h charts.
    const sourceData = hourlyHistorical || [];
    const hasHistoricalProfile = sourceData.length > 0;

    const curveData = sourceData.map(h => {
        // Now using REAL data from backend (no longer hardcoded 0s)
        const solarVal = Number(h.avg_power) || 0;
        const loadVal = Number(h.avg_load) || 0;

        // Grid Logic:
        // Use avg_import if available, or fall back to calculation
        // But for visual stacking (Solar vs Load), Grid is usually the gap.
        // Let's visualize: 
        // 1. Load (Base consumption)
        // 2. Solar (Generation)
        // 3. Grid Interaction (The delta)

        // If we strictly follow the AreaChart keys:
        // Load: The consumption curve
        // Solar: The generation curve
        // Grid: The difference (Import/Export)

        // The previous logic was: Grid = |Solar - Load|
        // This visualizes the "Activity" or "Stress" on the grid connection.
        // Let's keep that visual for now as it's intuitive for "Grid Interaction".

        return {
            time: formatTimeInSchoolTZ(h.hour, timezone),
            Solar: Number(solarVal.toFixed(1)),
            Load: Number(loadVal.toFixed(1)),
            Grid: Number(Math.abs(solarVal - loadVal).toFixed(1))
        };
    });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center flex-wrap gap-4">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-orange-500" />
                    Grid Interaction & Consumption
                </h3>
                <div className="flex bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
                    <button
                        onClick={() => setGranularity('1h')}
                        disabled={loading}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${granularity === '1h' ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        1H
                    </button>
                    <button
                        onClick={() => setGranularity('15min')}
                        disabled={loading}
                        className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${granularity === '15min' ? 'bg-orange-100 text-orange-700' : 'text-slate-500 hover:bg-slate-50'}`}
                    >
                        15M (Zoom)
                    </button>
                </div>
            </div>

            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 text-center">
                        <div className="text-xs text-orange-600 font-bold uppercase mb-1">Self-Consumption</div>
                        <div className="text-2xl font-bold text-slate-800">
                            {totalSolar > 0 ? Math.min(100, ((totalSolar - totalExport) / totalSolar * 100)).toFixed(1) : 0}%
                        </div>
                        <div className="text-xs text-slate-500">of Solar used onsite</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
                        <div className="text-xs text-blue-600 font-bold uppercase mb-1">Grid Export</div>
                        <div className="text-2xl font-bold text-slate-800">
                            {totalExport.toFixed(1)} <span className="text-sm">kW</span>
                        </div>
                        <div className="text-xs text-slate-500">Surplus Energy</div>
                    </div>
                    <div className="bg-slate-100 p-4 rounded-lg border border-slate-200 text-center">
                        <div className="text-xs text-slate-600 font-bold uppercase mb-1">Grid Import</div>
                        <div className="text-2xl font-bold text-slate-800">
                            {totalImport.toFixed(1)} <span className="text-sm">kW</span>
                        </div>
                        <div className="text-xs text-slate-500">Supplemental Power</div>
                    </div>
                </div>

                <div className="min-h-[320px] w-full">
                    {!hasHistoricalProfile ? (
                        <div className="h-full flex items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                            <EmptyState
                                icon={Zap}
                                title="Insufficient Data"
                                description="Historical profile requires at least 24 hours of telemetry."
                            />
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height={300}>
                            <AreaChart data={curveData}>
                                <defs>
                                    <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#eab308" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1} />
                                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="time" tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fontWeight: 600 }} axisLine={false} tickLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                    labelStyle={{ fontWeight: 700, marginBottom: '4px' }}
                                />
                                <Legend verticalAlign="top" align="right" iconType="circle" wrapperStyle={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                                <Area type="monotone" dataKey="Load" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#colorLoad)" />
                                <Area type="monotone" dataKey="Solar" stroke="#eab308" strokeWidth={2} fillOpacity={1} fill="url(#colorSolar)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>
        </div>
    );
};
