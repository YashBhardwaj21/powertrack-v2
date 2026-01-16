
import React, { useMemo } from 'react';
import { Telemetry, HistoricalData, School } from '../types';
import { DailyEnergyChart } from './charts/DailyEnergyChart';
import { CumulativeEnergyChart } from './charts/CumulativeEnergyChart';
import { SpecificYieldChart } from './charts/SpecificYieldChart';

interface PerformanceChartsProps {
    currentData: Telemetry[];
    historicalData: HistoricalData[];
    schools: School[];
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = React.memo(({ currentData, historicalData, schools }) => {

    // Data Transformation
    const { trendData, energyData } = useMemo(() => {
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

        // 3. Process Historical Data
        const trendData = historicalData.map(h => ({
            date: h.date,
            value: h.total_energy_kwh
        }));

        return { trendData, energyData };
    }, [currentData, historicalData, schools]);

    return (
        <div className="space-y-8 mb-8">
            <div className="grid grid-cols-12 gap-8">
                {/* Annual Trend (Cumulative Area) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-12">
                    <div className="mb-6">
                        <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Network Analytics</h3>
                        <h2 className="text-xl font-bold text-slate-900">Network Generation Trend</h2>
                        <p className="text-slate-500 text-sm">Total energy output across all schools over time</p>
                    </div>
                    <div className="min-h-[320px] w-full">
                        {trendData.length > 0 ? (
                            <CumulativeEnergyChart data={trendData} />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                No historical data available for trend analysis
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
                            <DailyEnergyChart data={energyData} />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                Waiting for daily telemetry
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
