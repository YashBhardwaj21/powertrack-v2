
import React, { useMemo } from 'react';
import { Telemetry, HistoricalData, School } from '../types';
import { DailyEnergyChart } from './charts/DailyEnergyChart';
import { DailyHistoryChart } from './charts/DailyHistoryChart';
import { formatTimeInSchoolTZ, formatDateInSchoolTZ } from '../utils/timezone';
import { fetchHourlyData, fetchAnalyticsRange } from '../services/dataService';

interface PerformanceChartsProps {
    currentData: Telemetry[];
    historicalData: HistoricalData[];
    hourlyHistorical?: Array<{ hour: string; avg_power: number; energy: number }>;
    dailyHistorical?: Array<{ date: string; total_energy_kwh: number }>; // New prop
    schools: School[];
    timezone?: string; // School's IANA timezone
}

export const PerformanceCharts: React.FC<PerformanceChartsProps> = React.memo(({ currentData, historicalData, hourlyHistorical, dailyHistorical, schools, timezone = 'UTC' }) => {
    const [range, setRange] = React.useState('30D');
    const [statsData, setStatsData] = React.useState<any[] | null>(null);
    const [loading, setLoading] = React.useState(false);

    // Interactive hourly state
    const [selectedDate, setSelectedDate] = React.useState<string | null>(null);
    const [hourlyData, setHourlyData] = React.useState<any[] | null>(null);
    const [hourlyLoading, setHourlyLoading] = React.useState(false);

    // Initial load: use props (which are default 30D and today's hourly)
    React.useEffect(() => {
        if (dailyHistorical) {
            setStatsData(dailyHistorical);
        }
    }, [dailyHistorical]);

    React.useEffect(() => {
        // Sync props to state if no date selected (live view)
        if (!selectedDate && hourlyHistorical) {
            setHourlyData(hourlyHistorical);
        }
    }, [hourlyHistorical, selectedDate]);

    const handleDateClick = async (dateStr: string) => {
        if (selectedDate === dateStr) return; // Already selected
        setSelectedDate(dateStr);
        setHourlyLoading(true);

        try {
            const result = await fetchHourlyData(dateStr);
            setHourlyData(result);
        } catch (err) {
            console.error(err);
        } finally {
            setHourlyLoading(false);
        }
    };

    const handleRangeChange = async (newRange: string) => {
        if (newRange === range) return;
        setRange(newRange);
        setLoading(true);

        try {
            // Calculate start/end dates
            const end = new Date();
            const start = new Date();
            switch (newRange) {
                case '1W': start.setDate(end.getDate() - 7); break;
                case '30D': start.setDate(end.getDate() - 30); break;
                case '6M': start.setMonth(end.getMonth() - 6); break;
                case '1Y': start.setFullYear(end.getFullYear() - 1); break;
            }

            const result = await fetchAnalyticsRange(start.toISOString(), end.toISOString());
            setStatsData(result.daily_series);
        } catch (err) {
            console.error(err);
            setStatsData([]);
        } finally {
            setLoading(false);
        }
    };

    // Data Transformation (Trend & Yield remain same)
    const { trendData, energyData } = useMemo(() => {
        const schoolMap = Object.fromEntries(schools.map(s => [s.id, s]));
        const energyData = currentData.map(d => {
            const school = schoolMap[d.school_id];
            const name = school ? school.name : d.school_id;
            const capacity = school ? school.total_capacity_kwp : 1;
            return {
                name: name,
                schoolId: d.school_id,
                value: d.daily_energy_kwh,
                specificYield: Number((d.daily_energy_kwh / capacity).toFixed(2))
            };
        });

        // Use our interactive state or fallback to prop (historical)
        const sourceData = hourlyData || hourlyHistorical || historicalData;

        const trendData = (sourceData as any[]).map((h: any) => ({
            label: h.hour ? formatTimeInSchoolTZ(h.hour, timezone) : '00:00',
            value: Number(h.avg_power) || 0
        }));
        return { trendData, energyData };
    }, [currentData, historicalData, hourlyHistorical, hourlyData, schools]);

    return (
        <div className="space-y-8 mb-8">
            <div className="grid grid-cols-12 gap-8">
                {/* Daily History (Bar) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-12">
                    <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                        <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Production History</h3>
                            <h2 className="text-xl font-bold text-slate-900">Total Energy Produced</h2>
                            <p className="text-slate-500 text-sm">Click a bar to view hourly details for that day</p>
                        </div>
                        <div className="flex bg-slate-100 rounded-lg p-1 border border-slate-200">
                            {['1W', '30D', '6M', '1Y'].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => handleRangeChange(r)}
                                    disabled={loading}
                                    className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${range === r
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-slate-500 hover:text-slate-700'
                                        }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="min-h-[320px] w-full relative">
                        {loading && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        )}
                        {statsData && statsData.length > 0 ? (
                            <DailyHistoryChart data={statsData} onDateClick={handleDateClick} />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                No history data available for this range
                            </div>
                        )}
                    </div>
                </div>

                {/* Hourly Production (Bar/Line) */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 col-span-12">
                    <div className="mb-6 flex justify-between items-center">
                        <div>
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">Performance Review</h3>
                            <h2 className="text-xl font-bold text-slate-900">
                                {selectedDate
                                    ? `Production on ${formatDateInSchoolTZ(selectedDate, timezone)}`
                                    : "Today's Production"
                                }
                            </h2>
                            <p className="text-slate-500 text-sm">
                                {selectedDate ? 'Hourly output for selected date' : (
                                    <>
                                        Energy generated since midnight: <span className="font-bold text-slate-900">
                                            {hourlyData && hourlyData.length > 0
                                                ? `${hourlyData.reduce((sum, h) => sum + (Number(h.energy) || 0), 0).toFixed(2)} kWh`
                                                : '0.00 kWh'}
                                        </span>
                                    </>
                                )}
                            </p>
                        </div>
                        {selectedDate && (
                            <button
                                onClick={() => { setSelectedDate(null); setHourlyData(hourlyHistorical || []); }}
                                className="text-xs font-medium text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-1.5 rounded-md"
                            >
                                Reset to Today
                            </button>
                        )}
                    </div>
                    <div className="min-h-[320px] w-full relative">
                        {hourlyLoading && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex items-center justify-center z-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        )}
                        {hourlyData && hourlyData.length > 0 ? (
                            <DailyEnergyChart data={hourlyData} timezone={timezone} />
                        ) : (
                            <div className="h-64 flex items-center justify-center text-slate-400 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                No data available for this period
                            </div>
                        )}
                    </div>
                </div>


            </div>
        </div>
    );
});
