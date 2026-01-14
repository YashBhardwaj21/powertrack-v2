
import React, { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Telemetry, HistoricalData, School } from '../types';

interface PerformanceChartsProps {
    currentData: Telemetry[];
    historicalData: HistoricalData[];
    schools: School[];
}

// Optimization: Memoize this component as it does heavy data processing
export const PerformanceCharts: React.FC<PerformanceChartsProps> = React.memo(({ currentData, historicalData, schools }) => {
    
    // Memoize the data transformation logic
    const { trendData, energyData } = useMemo(() => {
        // 1. Prepare Data for "Today's Production" & Specific Yield
        const sortedByEnergy = [...currentData].sort((a, b) => b.daily_energy_kwh - a.daily_energy_kwh);
        
        const energyData = sortedByEnergy.map(d => {
            // Fix: Use school.id instead of school.school_id
            const school = schools.find(s => s.id === d.school_id);
            const name = school ? school.name : d.school_id;
            const capacity = school ? school.total_capacity_kwp : 1;
            return {
                fullName: name,
                name: name, 
                energy: d.daily_energy_kwh,
                efficiency: d.efficiency_percent,
                specificYield: Number((d.daily_energy_kwh / capacity).toFixed(2)) // kWh / kWp
            };
        });

        // 2. Process Historical Data (Annual)
        const trendMap = new Map<string, number>();
        historicalData.forEach(item => {
            const current = trendMap.get(item.date) || 0;
            trendMap.set(item.date, current + item.total_energy_kwh);
        });
        
        const trendData = Array.from(trendMap.entries())
            .map(([date, total]) => ({ date: date, total: Number(total.toFixed(0)) }))
            .sort((a, b) => a.date.localeCompare(b.date));
        
        return { trendData, energyData };
    }, [currentData, historicalData, schools]);

    
    const formatXAxis = (tickItem: string) => {
        const date = new Date(tickItem);
        if (date.getDate() === 1) {
            return date.toLocaleDateString('en-US', { month: 'short' });
        }
        return '';
    };

    return (
        <div className="space-y-6 mb-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Annual Trend */}
                <div className="bg-white p-6 rounded-xl shadow-sm lg:col-span-2">
                    <h3 className="text-lg font-bold text-slate-800 mb-1">Annual Network Generation</h3>
                    <p className="text-slate-500 text-sm mb-4">Total energy produced over the last 365 days (Aggregated Daily)</p>
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={trendData}>
                                <defs>
                                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis 
                                    dataKey="date" 
                                    tickFormatter={formatXAxis} 
                                    tick={{fontSize: 12}} 
                                    tickLine={false} 
                                    axisLine={false} 
                                    interval={0}
                                    minTickGap={10}
                                />
                                <YAxis tick={{fontSize: 12}} tickLine={false} axisLine={false} />
                                <Tooltip 
                                    labelFormatter={(label) => new Date(label).toLocaleDateString('en-US', {weekday: 'short', year: 'numeric', month: 'long', day: 'numeric'})}
                                    contentStyle={{borderRadius: '8px'}} 
                                />
                                <Area type="monotone" dataKey="total" stroke="#2563eb" fillOpacity={1} fill="url(#colorTotal)" isAnimationActive={false} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Specific Yield Benchmark (kWh/kWp) */}
                <div className="bg-white p-6 rounded-xl shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-1">Specific Yield Benchmark</h3>
                    <p className="text-slate-500 text-xs mb-4">Normalized Efficiency (kWh per kWp installed)</p>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={energyData.slice(0, 7)} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{fontSize: 11, fill: '#475569'}} 
                                    axisLine={false} 
                                    interval={0}
                                    angle={-45} 
                                    textAnchor="end"
                                    height={80}
                                />
                                <Tooltip 
                                    cursor={{fill: '#f1f5f9'}} 
                                    contentStyle={{ borderRadius: '8px' }} 
                                />
                                <Bar dataKey="specificYield" name="Specific Yield (kWh/kWp)" fill="#8b5cf6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Energy Production Comparison */}
                <div className="bg-white p-6 rounded-xl shadow-sm">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">Today's Production (Absolute)</h3>
                    <div className="h-[400px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={energyData.slice(0, 7)} margin={{ top: 10, right: 10, left: 0, bottom: 60 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                                <XAxis 
                                    dataKey="name" 
                                    tick={{fontSize: 11, fill: '#475569'}} 
                                    axisLine={false} 
                                    interval={0}
                                    angle={-45} 
                                    textAnchor="end"
                                    height={80}
                                />
                                <Tooltip 
                                    cursor={{fill: '#f1f5f9'}} 
                                    contentStyle={{ borderRadius: '8px' }} 
                                />
                                <Bar dataKey="energy" name="Energy (kWh)" fill="#3b82f6" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
});
