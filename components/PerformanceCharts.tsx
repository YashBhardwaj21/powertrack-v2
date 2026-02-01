
import React, { useMemo } from 'react';
import { Telemetry, HistoricalData, School } from '../types';
import { DailyEnergyChart } from './charts/DailyEnergyChart';
import { SpecificYieldChart } from './charts/SpecificYieldChart';
import { DailyHistoryChart } from './charts/DailyHistoryChart';

interface PerformanceChartsProps {
    currentData: Telemetry[];
    historicalData: HistoricalData[];
    hourlyHistorical?: Array<{ hour: string; avg_power: number; energy: number }>;
    dailyHistorical?: Array<{ date: string; total_energy_kwh: number }>; // New prop
    schools: School[];
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = React.memo(({ currentData, historicalData, hourlyHistorical, dailyHistorical, schools }) => {

    // Data Transformation
    const { trendData, energyData } = useMemo(() => {
        // ... (existing logic remains)
        // 1. Create a hashmap for O(1) school lookups
        const schoolMap = Object.fromEntries(schools.map(s => [s.id, s]));

        // 2. Prepare Data for "Today's Production" & Specific Yield
        const energyData = currentData.map(d => {
            const school = schoolMap[d.school_id];
            const name = school ? school.name : d.school_id;
            const capacity = school ? school.total_capacity_kwp : 1;

            return {
                name: name,
                schoolId: d.school_id,
                value: d.daily_energy_kwh,
                specificYield: Number((d.daily_energy_kwh / capacity).toFixed(2)) // kWh / kWp
            };
        });

        // 3. Process Historical Data (Last 24h Trend)
        // Prefer new 'hourlyHistorical' if available, otherwise fall back to deprecated 'historicalData'
        const sourceData = hourlyHistorical || historicalData;

        const trendData = sourceData.map((h: any) => ({
            label: new Date(h.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            value: Number(h.avg_power) || 0
        }));

        return { trendData, energyData };
    }, [currentData, historicalData, hourlyHistorical, schools]);

    return (
        <div className="space-y-8 mb-8">
            <div className="grid grid-cols-12 gap-8">
                {/* Daily History (Bar) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-12">
                    <div className="mb-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Production History</h3>
                        <h2 className="text-xl font-bold text-slate-900">Total Energy Produced</h2>
                        <p className="text-slate-500 text-sm">Daily energy generation summary</p>
                    </div>
                    <div className="min-h-[320px] w-full">
                        {dailyHistorical && dailyHistorical.length > 0 ? (
                            <DailyHistoryChart data={dailyHistorical} />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                No daily history data available
                            </div>
                        )}
                    </div>
                </div>

                {/* Today's Production (Bar) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-12 lg:col-span-6">
                    <div className="mb-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Performance Review</h3>
                        <h2 className="text-xl font-bold text-slate-900">Today's Production</h2>
                        <p className="text-slate-500 text-sm">Energy generated since midnight</p>
                    </div>
                    <div className="min-h-[320px] w-full">
                        {energyData.length > 0 ? (
                            hourlyHistorical && hourlyHistorical.length > 0 ? (
                                <DailyEnergyChart data={hourlyHistorical} />
                            ) : (
                                <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                    Waiting for daily telemetry
                                </div>
                            )
                        ) : (
                            <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                No current energy data available
                            </div>
                        )}
                    </div>
                </div>

                {/* Specific Yield (Bar) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-12 lg:col-span-6">
                    <div className="mb-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Efficiency Benchmark</h3>
                        <h2 className="text-xl font-bold text-slate-900">Specific Yield</h2>
                        <p className="text-slate-500 text-sm">Normalized performance (kWh produced per kWp installed)</p>
                    </div>
                    <div className="min-h-[320px] w-full">
                        {energyData.length > 0 ? (
                            <SpecificYieldChart data={energyData.map(d => ({ name: d.name, value: d.specificYield }))} />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                Insufficient data for benchmark
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
});
