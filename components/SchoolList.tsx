
import React from 'react';
import { School, Telemetry, SchoolMetadata } from '../types';
import { MapPin, Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { WEATHER_ICONS } from '../constants';

interface SchoolListProps {
    schools: School[];
    currentData: Telemetry[];
    metadata: SchoolMetadata;
}

export const SchoolList: React.FC<SchoolListProps> = ({ schools, currentData, metadata }) => {
    return (
        <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                <span className="text-blue-600">🏫</span> Participating Schools
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-6">
                {schools.map(school => {
                    // Fix: Use school.id instead of school.school_id
                    const data = currentData.find(d => d.school_id === school.id);
                    if (!data) return null;

                    const moneySaved = data.daily_energy_kwh * metadata.electricity_rate_idr;
                    const percentCapacity = (data.ac_power_kw / school.total_capacity_kwp) * 100;

                    let statusColor = 'bg-green-100 text-green-700';
                    let statusIcon = <Wifi className="w-3 h-3" />;
                    let statusText = 'Online';

                    if (data.fault === 'comm_down') {
                        statusColor = 'bg-slate-100 text-slate-500';
                        statusIcon = <WifiOff className="w-3 h-3" />;
                        statusText = 'Offline';
                    } else if (data.fault !== 'none') {
                        statusColor = 'bg-red-100 text-red-700';
                        statusIcon = <AlertTriangle className="w-3 h-3" />;
                        statusText = 'Fault';
                    }

                    return (
                        <div key={school.id} className="bg-white rounded-xl shadow-sm hover:shadow-lg transition-all duration-300 overflow-hidden border border-slate-100 group">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-blue-900 to-blue-800 p-4 text-white flex justify-between items-start">
                                <div className="overflow-hidden">
                                    <h3 className="font-bold text-lg truncate" title={school.name}>{school.name}</h3>
                                    <span className="inline-block mt-1 text-xs bg-white/20 px-2 py-0.5 rounded-full backdrop-blur-sm">
                                        {school.type}
                                    </span>
                                </div>
                            </div>

                            {/* Body */}
                            <div className="p-4">
                                {/* Location & Status */}
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-1 text-sm text-slate-500">
                                        <MapPin className="w-3 h-3" />
                                        <span className="text-xs truncate max-w-[120px]">{school.district}</span>
                                    </div>
                                    <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor}`}>
                                        {statusIcon}
                                        {statusText}
                                    </div>
                                </div>

                                {/* Key Metrics Grid */}
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-blue-50 p-2 rounded-lg">
                                        <p className="text-[10px] text-blue-600 font-semibold uppercase">Output</p>
                                        <p className="text-lg font-bold text-blue-900 leading-tight">{data.ac_power_kw.toFixed(2)} <span className="text-xs font-normal">kW</span></p>
                                    </div>
                                    <div className="bg-green-50 p-2 rounded-lg">
                                        <p className="text-[10px] text-green-600 font-semibold uppercase">Daily</p>
                                        <p className="text-lg font-bold text-green-900 leading-tight">{data.daily_energy_kwh.toFixed(2)} <span className="text-xs font-normal">kWh</span></p>
                                    </div>
                                </div>

                                {/* Capacity Bar */}
                                <div className="mb-4">
                                    <div className="flex justify-between text-xs mb-1">
                                        <span className="text-slate-500">Load</span>
                                        <span className="font-medium text-slate-700">{percentCapacity.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all duration-500 ${data.fault !== 'none' && data.fault !== 'comm_down' ? 'bg-red-500' : 'bg-blue-500'}`}
                                            style={{ width: `${Math.min(100, percentCapacity)}%` }}
                                        />
                                    </div>
                                </div>

                                {/* Footer Stats */}
                                <div className="pt-3 border-t border-slate-100 flex justify-between items-center text-sm">
                                    <div className="flex items-center gap-1 text-slate-600">
                                        <span className="text-lg">{WEATHER_ICONS[data.weather_condition]}</span>
                                        <span className="text-xs font-mono">{data.panel_temp_c.toFixed(0)}°C</span>
                                    </div>
                                    <div className="font-semibold text-emerald-600 text-xs">
                                        Rp {(moneySaved / 1000).toFixed(0)}k
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
