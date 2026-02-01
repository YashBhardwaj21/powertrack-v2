import React from 'react';
import { School, Telemetry, SchoolMetadata } from '../types';
import { Trophy, Medal, Award } from 'lucide-react';

export interface LeaderboardProps {
    schools?: School[];
    currentData?: Telemetry[];
    leaderboardStats?: any[]; // Using any[] to map to PublicLeaderboardEntry
    metadata?: SchoolMetadata;
    onSelectSchool?: (schoolId: string) => void;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
    schools = [],
    currentData = [],
    leaderboardStats = [],
    metadata = { electricity_rate_idr: 0, carbon_intensity_kg_per_kwh: 0 },
    onSelectSchool
}) => {
    // Safety check for nulls (defaults only handle undefined)
    const safeSchools = schools || [];
    const safeData = currentData || [];
    const safeStats = leaderboardStats || [];
    const safeMetadata = metadata || { electricity_rate_idr: 0, carbon_intensity_kg_per_kwh: 0 };

    // Combine and sort data
    // Pivot: We want to show all schools that have stats.
    // If we use currentData map, we miss schools with stats but no recent packet.
    // Use safeStats (Aggregated) as the base list.
    const sortedData = [...safeStats]
        .sort((a, b) => (Number(b.total_energy_kwh) || 0) - (Number(a.total_energy_kwh) || 0))
        .map((stat, index) => {
            const school = safeSchools.find(s => s.id === stat.school_id);
            // Join real-time power data from currentData
            const telemetry = safeData.find(d => d.school_id === stat.school_id);

            return {
                ...stat,
                school,
                ac_power_kw: telemetry?.ac_power_kw || 0, // Inject real-time power
                rank: index + 1
            };
        });

    const getRankIcon = (rank: number) => {
        switch (rank) {
            case 1: return <Trophy className="w-5 h-5 text-yellow-500" />;
            case 2: return <Medal className="w-5 h-5 text-slate-400" />;
            case 3: return <Medal className="w-5 h-5 text-amber-600" />;
            default: return <span className="w-5 h-5 flex items-center justify-center font-bold text-slate-400 text-sm">{rank}</span>;
        }
    };

    return (
        <div className="h-full flex flex-col bg-white overflow-hidden">
            <div className="overflow-y-auto flex-1">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider sticky top-0 z-10 border-b border-slate-200">
                        <tr>
                            <th className="px-4 py-3 bg-slate-50">#</th>
                            <th className="px-4 py-3 bg-slate-50">School</th>
                            <th className="px-4 py-3 text-right bg-slate-50">Power</th>
                            <th className="px-4 py-3 text-right bg-slate-50">Energy</th>
                            <th className="px-4 py-3 text-right bg-slate-50 hidden sm:table-cell">CO2</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedData.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-400 text-sm">
                                    No data available yet today.
                                </td>
                            </tr>
                        ) : (
                            sortedData.map((row) => (
                                <tr
                                    key={row.school_id}
                                    className="hover:bg-blue-50/50 transition-colors group cursor-pointer"
                                    onClick={() => onSelectSchool && onSelectSchool(row.school_id)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center w-6 h-6">
                                            {getRankIcon(row.rank)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-slate-700 text-sm group-hover:text-blue-700 truncate max-w-[120px]">{row.school_name || row.school?.name || 'Unknown'}</div>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-wide">{row.school?.district || 'District Not Set'}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-700 font-bold text-sm">
                                        <div className="flex items-center justify-end gap-1">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                            {(Number(row.ac_power_kw) || 0).toFixed(2)} <span className="text-[10px] font-normal text-slate-400">kW</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-700 font-bold text-sm">
                                        {(Number(row.total_energy_kwh) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <span className="text-[10px] font-normal text-slate-400">kWh</span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-emerald-600 font-medium text-sm hidden sm:table-cell">
                                        {(Number(row.total_energy_kwh || 0) * (safeMetadata.carbon_intensity_kg_per_kwh || 0.85)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}kg
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};