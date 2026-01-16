import React from 'react';
import { School, Telemetry, SchoolMetadata } from '../types';
import { Trophy, Medal, Award } from 'lucide-react';

export interface LeaderboardProps {
    schools?: School[];
    currentData?: Telemetry[];
    metadata?: SchoolMetadata;
}

export const Leaderboard: React.FC<LeaderboardProps> = ({
    schools = [],
    currentData = [],
    metadata = { electricity_rate_idr: 0, carbon_intensity_kg_per_kwh: 0 }
}) => {
    // Combine and sort data
    const sortedData = [...currentData]
        .sort((a, b) => b.daily_energy_kwh - a.daily_energy_kwh)
        .map((data, index) => {
            // Fix: Use school.id instead of school.school_id
            const school = schools.find(s => s.id === data.school_id);
            return { ...data, school, rank: index + 1 };
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
                            <th className="px-4 py-3 text-right bg-slate-50">Energy</th>
                            <th className="px-4 py-3 text-right bg-slate-50 hidden sm:table-cell">Svgs</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedData.length === 0 ? (
                            <tr>
                                <td colSpan={4} className="p-8 text-center text-slate-400 text-sm">
                                    No data available yet today.
                                </td>
                            </tr>
                        ) : (
                            sortedData.map((row) => (
                                <tr key={row.school_id} className="hover:bg-blue-50/50 transition-colors group">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center w-6 h-6">
                                            {getRankIcon(row.rank)}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="font-bold text-slate-700 text-sm group-hover:text-blue-700 truncate max-w-[120px]">{row.school?.name || 'Unknown'}</div>
                                        <div className="text-[10px] text-slate-400 uppercase tracking-wide">{row.school?.district}</div>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono text-slate-700 font-bold text-sm">
                                        {(row.daily_energy_kwh || 0).toFixed(1)} <span className="text-[10px] font-normal text-slate-400">kWh</span>
                                    </td>
                                    <td className="px-4 py-3 text-right text-emerald-600 font-medium text-sm hidden sm:table-cell">
                                        {((row.daily_energy_kwh || 0) * (metadata.electricity_rate_idr || 0) / 1000).toFixed(0)}k
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