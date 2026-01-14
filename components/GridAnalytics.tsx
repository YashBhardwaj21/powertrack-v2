
import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Telemetry, School } from '../types';
import { Zap, Home, ArrowRightLeft } from 'lucide-react';

interface GridAnalyticsProps {
    currentData: Telemetry[];
    schools: School[];
}

export const GridAnalytics: React.FC<GridAnalyticsProps> = ({ currentData, schools }) => {
    // Aggregated data for the whole fleet
    const totalSolar = currentData.reduce((acc, curr) => acc + curr.ac_power_kw, 0);
    const totalLoad = currentData.reduce((acc, curr) => acc + curr.load_kw, 0);
    const totalExport = currentData.reduce((acc, curr) => acc + curr.grid_export_kw, 0);
    const totalImport = currentData.reduce((acc, curr) => acc + curr.grid_import_kw, 0);
    
    // Simulate a 24-hour curve based on current snapshot for visualization
    // In a real app, this would come from the historical DB aggregation
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const curveData = hours.map(h => {
        // Solar Curve (Bell curve peaking at 12)
        let solarFactor = 0;
        if (h >= 6 && h <= 18) {
             solarFactor = Math.sin(((h - 6) / 12) * Math.PI);
        }
        
        // Load Curve (Double hump: Morning 8-10, Afternoon 13-15)
        let loadFactor = 0.3; // Baseload
        if (h >= 7 && h <= 17) loadFactor = 0.8;
        if (h === 12) loadFactor = 0.6; // Lunch dip

        // Scale factors to current totals roughly
        const solar = totalSolar * solarFactor; // Simplified scaling
        const load = totalLoad * loadFactor * 1.5;

        return {
            time: `${h}:00`,
            Solar: Number(solar.toFixed(1)),
            Load: Number(load.toFixed(1)),
            Grid: Number((load - solar).toFixed(1))
        };
    });

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-orange-500" />
                    Grid Interaction & Consumption
                </h3>
            </div>
            
            <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100 text-center">
                        <div className="text-xs text-orange-600 font-bold uppercase mb-1">Self-Consumption</div>
                        <div className="text-2xl font-bold text-slate-800">
                            {totalSolar > 0 ? ((totalSolar - totalExport)/totalSolar * 100).toFixed(1) : 0}%
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

                <div className="h-[300px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={curveData}>
                            <defs>
                                <linearGradient id="colorSolar" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#eab308" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#eab308" stopOpacity={0}/>
                                </linearGradient>
                                <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.8}/>
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <XAxis dataKey="time" tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                            <YAxis tick={{fontSize: 12}} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{borderRadius: '8px'}} />
                            <Legend verticalAlign="top" height={36}/>
                            <Area type="monotone" dataKey="Load" stroke="#6366f1" fillOpacity={1} fill="url(#colorLoad)" />
                            <Area type="monotone" dataKey="Solar" stroke="#eab308" fillOpacity={1} fill="url(#colorSolar)" />
                        </AreaChart>
                    </ResponsiveContainer>
                    <p className="text-center text-xs text-slate-400 mt-2">Simulated 24h Daily Load Profile vs Solar Generation (Fleet Aggregate)</p>
                </div>
            </div>
        </div>
    );
};
