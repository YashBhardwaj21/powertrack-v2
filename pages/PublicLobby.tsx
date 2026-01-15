
import React, { useEffect, useState } from 'react';
import { Trophy, Leaf, Zap, Globe, ArrowRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchPublicLeaderboard } from '../services/dataService';

export const PublicLobby: React.FC = () => {
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchPublicLeaderboard().then(data => {
            setLeaderboard(data);
            setLoading(false);
        });
    }, []);

    return (
        <div className="space-y-12 py-8">
            <section className="text-center space-y-4 max-w-3xl mx-auto">
                <div className="inline-flex items-center gap-2 bg-emerald-100 text-emerald-700 px-4 py-1.5 rounded-full text-sm font-bold border border-emerald-200">
                    <Globe className="w-4 h-4" /> Live Network Tracking
                </div>
                <h1 className="text-5xl font-black text-slate-900 leading-tight">
                    Powering West Java's <span className="text-blue-600">Green Future</span>
                </h1>
                <p className="text-lg text-slate-500">
                    Real-time monitoring of community solar installations across educational institutions.
                </p>
            </section>

            {loading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>
            ) : (
                <section className="bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
                    <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">Sustainability League</h2>
                            <p className="text-slate-500">Cumulative energy performance ranking</p>
                        </div>
                        <Link to="/login" className="text-blue-600 font-bold flex items-center gap-2 hover:gap-3 transition-all">
                            Staff Dashboard Login <ArrowRight className="w-4 h-4" />
                        </Link>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-50 text-slate-400 text-xs uppercase font-bold tracking-widest">
                                <tr>
                                    <th className="px-8 py-4">Rank</th>
                                    <th className="px-8 py-4">School</th>
                                    <th className="px-8 py-4">Energy Generated</th>
                                    <th className="px-8 py-4">CO2 Saved</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {leaderboard.length === 0 ? (
                                    <tr><td colSpan={4} className="p-12 text-center text-slate-400">No data available from network.</td></tr>
                                ) : (
                                    leaderboard.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-8 py-6 font-black text-slate-300 text-xl">#{idx + 1}</td>
                                            <td className="px-8 py-6 font-bold text-slate-800">{item.name}</td>
                                            <td className="px-8 py-6 font-mono text-blue-600 font-bold">{item.total_energy_kwh.toLocaleString()} kWh</td>
                                            <td className="px-8 py-6 font-mono text-emerald-600 font-bold">{(item.total_energy_kwh * 0.85).toLocaleString()} kg</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>
            )}
        </div>
    );
};
