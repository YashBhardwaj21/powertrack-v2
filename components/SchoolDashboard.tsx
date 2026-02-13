import React, { useContext } from 'react';
import { AuthContext } from '../App';
import { useDashboard } from '../context/DashboardContext';
import { formatPower, formatEnergy, formatCO2, formatPercentage, formatLastUpdated, formatCurrency } from '../utils/formatters';
import { isFresh } from '../utils/timezone';
import { PowerFlowChart } from './charts/PowerFlowChart';
import {
    Zap, Home, ArrowRightLeft, Leaf, Calendar, CheckCircle2, AlertTriangle,
    Wifi, Activity, Sun, Battery, Server, DollarSign
} from 'lucide-react';

export const SchoolDashboard: React.FC = () => {
    const auth = useContext(AuthContext);
    const { data } = useDashboard();

    // 1. Safe Data Access
    const schoolId = auth?.user?.school_id;
    const school = data?.schools?.find(s => s.id === schoolId);
    const currentData = data?.current_data?.filter(d => d.school_id === schoolId) || [];
    // Get the MOST RECENT telemetry point (assuming sorted or take last)
    // The backend usually sends current_data as ONE point per school (latest).
    // But `current_data` is an array. Let's find the one matching schoolId.
    const latestTelemetry = currentData.length > 0 ? currentData[0] : null;

    // 2. Calculate Live KPIs
    const solarKw = Number(latestTelemetry?.ac_power_kw) || 0;
    const loadKw = Number(latestTelemetry?.load_kw) || 0;
    const gridImportKw = Number(latestTelemetry?.grid_import_kw) || 0;
    const gridExportKw = Number(latestTelemetry?.grid_export_kw) || 0;

    // Grid Net Flow: +ve = Importing, -ve = Exporting
    const gridNetKw = gridImportKw - gridExportKw;

    // Self Consumption %
    // Formula: (Solar - Export) / Solar
    // If Solar = 0, Self Consumption is mathematically undefined, but functionally 0 (or 100% of 0? usually 0).
    const selfConsumedKw = Math.max(0, solarKw - gridExportKw);
    let selfConsumptionRatio = 0;
    if (solarKw > 0) {
        selfConsumptionRatio = (selfConsumedKw / solarKw) * 100;
    }

    // 3. Calculate Cumulative KPIs
    const todayEnergy = Number(latestTelemetry?.daily_energy_kwh) || 0;

    // Month Energy: Sum of daily logs for this month from daily_historical?
    // Or just use a placeholder if backend doesn't aggregate "Month to Date" explicitly.
    // DashboardData has `daily_historical`. Let's sum it up.
    // Filter for current month? Assuming daily_historical is relevant range.
    const monthEnergy = data?.daily_historical?.reduce((sum, day) => sum + Number(day.total_energy_kwh), 0) || 0;

    // CO2 Avoided & Savings
    const co2Factor = data?.metadata?.carbon_intensity_kg_per_kwh || 0.85; // Default fallback
    const tariff = data?.metadata?.electricity_rate_idr || 1444.70; // Fallback to standard tariff

    // Let's use Lifetime Energy for CO2 if available? 
    // Types says `leaderboard_stats` has `total_energy_kwh` (lifetime).
    const lifetimeStats = data?.leaderboard_stats?.find(s => s.school_id === schoolId);
    const lifetimeEnergy = Number(lifetimeStats?.total_energy_kwh) || 0;
    const lifetimeCO2 = lifetimeEnergy * co2Factor;
    const lifetimeSavings = lifetimeEnergy * tariff;

    // 4. Component Status Logic (using timezone-aware freshness check)
    const isOnline = latestTelemetry && isFresh(latestTelemetry.timestamp, 5 * 60 * 1000); // 5 mins
    const inverterStatus = isOnline ? 'ok' : 'error';
    const sensorStatus = isOnline ? 'ok' : 'warning';

    // 5. Chart Data
    // Use hourly_historical which has { hour, avg_power, avg_load ... }
    const chartData = data?.hourly_historical || [];

    const StatusIcon = ({ status, label }: { status: 'ok' | 'warning' | 'error', label: string }) => {
        let icon = <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
        let textClass = "text-slate-600";
        if (status === 'warning') {
            icon = <AlertTriangle className="w-4 h-4 text-amber-500" />;
        } else if (status === 'error') {
            icon = <Activity className="w-4 h-4 text-red-500" />;
        }

        return (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
                {icon}
                <span className={`text-xs font-bold uppercase tracking-wider ${textClass}`}>{label}</span>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* 1. Header */}
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">
                        {school?.name || 'School Command Center'}
                    </h1>
                    <p className="text-slate-500 text-xs mt-2 font-medium">
                        Real-time System Monitoring
                    </p>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center space-x-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                        <div className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">
                            Sync: {formatLastUpdated(latestTelemetry?.timestamp)}
                        </span>
                    </div>
                </div>
            </header>

            {/* 2. KPI Cards (Live Power) */}
            <div>
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-3">Live Power Metrics</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {/* Solar Generation (Now Lifetime Energy) */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                            <Sun className="w-16 h-16 text-amber-500" />
                        </div>
                        <div className="flex items-center gap-2 mb-2">
                            <Zap className="w-4 h-4 text-amber-500" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Solar Generation</span>
                        </div>
                        <div>
                            {/* Changed to Lifetime Energy as primary */}
                            <span className="text-3xl font-bold text-slate-900">{formatEnergy(lifetimeEnergy)}</span>
                        </div>
                        {/* Subtitle removed as requested */}
                    </div>

                    {/* Load Consumption */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
                        <div className="flex items-center gap-2 mb-2">
                            <Home className="w-4 h-4 text-blue-500" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Load Consumption</span>
                        </div>
                        <div>
                            <span className="text-3xl font-bold text-slate-900">{loadKw.toFixed(2)}</span>
                            <span className="text-sm font-medium text-slate-400 ml-1">kW</span>
                        </div>
                        {/* Removed Today pills as requested */}
                    </div>

                    {/* Grid Interaction */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
                        <div className="flex items-center gap-2 mb-2">
                            <ArrowRightLeft className={`w-4 h-4 ${gridNetKw > 0 ? 'text-red-500' : 'text-emerald-500'}`} />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Grid Interaction</span>
                        </div>
                        <div>
                            <div className="flex items-baseline">
                                <span className={`text-3xl font-bold ${gridNetKw > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                                    {Math.abs(gridNetKw).toFixed(2)}
                                </span>
                                <span className="text-sm font-medium text-slate-400 ml-1">kW</span>
                            </div>
                        </div>
                        <div className={`mt-2 text-[10px] font-bold inline-block px-2 py-0.5 rounded-full ${gridNetKw > 0 ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50'}`}>
                            {gridNetKw > 0 ? 'Importing' : 'Exporting'}
                        </div>
                    </div>

                    {/* Lifetime Savings (Was Lifetime Yield) */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between h-32">
                        <div className="flex items-center gap-2 mb-2">
                            <DollarSign className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Lifetime Savings</span>
                        </div>
                        <div>
                            <span className="text-3xl font-bold text-slate-900">{formatCurrency(lifetimeSavings)}</span>
                        </div>
                        {/* Logic: Removed "Saved" pill as requested. */}
                    </div>
                </div>
            </div>

            {/* 3. Main Chart Section */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-[400px]">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Live Power Flow (24h)</h3>
                    </div>
                    <div className="h-[320px]">
                        <PowerFlowChart data={chartData} timezone={school?.timezone || 'Asia/Jakarta'} />
                    </div>
                </div>

                {/* 4. Energy Summary & Status Side Panel */}
                <div className="space-y-6">
                    {/* Energy KPIs */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">Energy Summary</h3>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Activity className="w-5 h-5 text-blue-500" />
                                <span className="text-xs font-bold text-slate-600 uppercase">Today's Energy</span>
                            </div>
                            <span className="text-lg font-bold text-slate-900">{formatEnergy(todayEnergy)}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-5 h-5 text-indigo-500" />
                                <span className="text-xs font-bold text-slate-600 uppercase">This Month</span>
                            </div>
                            <span className="text-lg font-bold text-slate-900">{formatEnergy(monthEnergy)}</span>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex items-center gap-3">
                                <Leaf className="w-5 h-5 text-emerald-500" />
                                <span className="text-xs font-bold text-slate-600 uppercase">Lifetime CO₂</span>
                            </div>
                            <span className="text-lg font-bold text-slate-900">{formatCO2(lifetimeCO2)}</span>
                        </div>
                    </div>

                    {/* System Status Panel */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                        <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">System Health</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <StatusIcon status={inverterStatus} label="Inverter" />
                            <StatusIcon status={isOnline ? 'ok' : 'error'} label="Data Link" />
                            <StatusIcon status={sensorStatus} label="Sensors" />
                            <StatusIcon status={'ok'} label="Grid Sync" />
                        </div>
                        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
                            <span className="text-slate-400">Last heartbeat</span>
                            <span className="font-mono font-bold text-slate-600">{formatLastUpdated(latestTelemetry?.timestamp)}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
