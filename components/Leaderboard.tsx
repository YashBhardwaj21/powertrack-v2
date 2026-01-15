
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
        <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-8 h-[600px] flex flex-col">
            <div className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white flex-shrink-0">
                <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                    <Award className="text-blue-600" />
                    Community Leaderboard
                </h2>
                <p className="text-xs text-slate-500 mt-1">Ranked by today's production</p>
            </div>
            <div className="overflow-y-auto flex-grow custom-scrollbar">
                <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-600 text-xs uppercase font-semibold sticky top-0 z-10">
                        <tr>
                            <th className="px-6 py-4 bg-slate-50">Rank</th>
                            <th className="px-6 py-4 bg-slate-50">School</th>
                            <th className="px-6 py-4 text-right bg-slate-50">Energy</th>
                            <th className="px-6 py-4 text-right bg-slate-50 hidden sm:table-cell">Svgs</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {sortedData.map((row) => (
                            <tr key={row.school_id} className="hover:bg-blue-50/50 transition-colors">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        {getRankIcon(row.rank)}
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="font-semibold text-slate-800 text-sm">{row.school?.name || 'Unknown'}</div>
                                    <div className="text-xs text-slate-500">{row.school?.district}</div>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-blue-600 font-bold text-sm">
                                    {row.daily_energy_kwh.toFixed(1)} <span className="text-xs font-normal text-slate-400">kWh</span>
                                </td>
                                <td className="px-6 py-4 text-right text-slate-600 text-sm hidden sm:table-cell">
                                    {(row.daily_energy_kwh * metadata.electricity_rate_idr / 1000).toFixed(0)}k
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
