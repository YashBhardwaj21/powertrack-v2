import React, { useEffect, useState } from 'react';
import { Trophy, Leaf, Zap, Globe, ArrowRight, Loader2, Factory, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchPublicLeaderboard } from '../services/dataService';
import { AppHeader } from '../components/AppHeader';
import { AppFooter } from '../components/AppFooter';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

export const PublicLobby: React.FC = () => {
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadData = async () => {
        const data = await fetchPublicLeaderboard();
        setLeaderboard(data);
        setLoading(false);
    };

    useEffect(() => {
        loadData();

        // Live Sync for Public Lobby
        const ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('✅ Public Live Sync Connected');
            ws.send(JSON.stringify({ type: 'subscribe', schoolId: 'all' }));
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                if (msg.type === 'telemetry_update') {
                    // Re-fetch leaderboard on any update
                    loadData();
                }
            } catch (e) {
                console.error('WS Parse Error', e);
            }
        };

        return () => {
            ws.close();
        };
    }, []);

    // Calculate dynamic stats from all schools in leaderboard
    const totalSchools = leaderboard.length;
    const activeSchools = leaderboard.filter(s => s.total_energy_kwh > 0);
    const totalEnergy = activeSchools.reduce((acc, curr) => acc + (curr.total_energy_kwh || 0), 0);
    const totalCO2 = totalEnergy * 0.85; // Standard factor

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col overflow-x-hidden">
            <AppHeader />

            <main className="flex-grow">
                {/* Hero Section */}
                <div className="bg-slate-900 border-b border-slate-800 relative overflow-hidden">
                    {/* Background Pattern - Subtle dots */}
                    <div className="absolute inset-0 opacity-[0.15] bg-[radial-gradient(#475569_1px,transparent_1px)] [background-size:24px_24px]" />

                    <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 text-center relative z-10">
                        <div className="max-w-4xl mx-auto space-y-8">

                            <h1 className="text-5xl md:text-7xl font-bold text-white leading-tight tracking-tight uppercase">
                                Powering West Java's <br />
                                <span className="text-white">Green Infrastructure</span>
                            </h1>

                            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed font-medium">
                                Enterprise monitoring platform for public solar installations.
                                Real-time telemetry tracking energy yield and carbon displacement.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto pt-12">
                                <div className="p-6 rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 shadow-inner">
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Network Nodes</div>
                                    <div className="text-3xl font-bold text-white font-mono">{totalSchools}</div>
                                </div>
                                <div className="p-6 rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 shadow-inner">
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Yield Aggregate</div>
                                    <div className="text-3xl font-bold text-emerald-400 font-mono">
                                        {totalEnergy.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs font-bold opacity-60">kWh</span>
                                    </div>
                                </div>
                                <div className="p-6 rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 shadow-inner">
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Carbon Offset</div>
                                    <div className="text-3xl font-bold text-blue-400 font-mono">
                                        {totalCO2.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs font-bold opacity-60">kg</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 -mt-12 relative z-20 pb-20">
                    {loading ? (
                        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-20 flex flex-col items-center justify-center min-h-[400px]">
                            <Loader2 className="animate-spin text-blue-500 w-12 h-12 mb-4" />
                            <p className="text-slate-500 font-medium">Loading network telemetry...</p>
                        </div>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100 ring-1 ring-slate-900/5">
                            {/* Section Header */}
                            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                        <Trophy className="w-6 h-6 text-yellow-500" />
                                        Sustainability League
                                    </h2>
                                    <p className="text-slate-500 mt-1 text-sm">Real-time performance ranking by energy production</p>
                                </div>
                                <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg border border-emerald-100">
                                    <Activity className="w-4 h-4" />
                                    Live Network
                                </div>
                            </div>

                            {/* Leaderboard Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-slate-50 text-slate-400 text-[10px] uppercase font-bold tracking-[0.2em] border-b border-slate-100">
                                        <tr>
                                            <th className="px-8 py-5 w-24 text-center">Rank</th>
                                            <th className="px-8 py-5">Institution</th>
                                            <th className="px-8 py-5">Status</th>
                                            <th className="px-8 py-5 text-right">Yield (Total)</th>
                                            <th className="px-8 py-5 text-right">CO₂ Offset</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {leaderboard.filter(i => i.total_energy_kwh > 0).length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-24">
                                                    <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
                                                        <div className="bg-slate-50 p-6 rounded-full mb-6 border border-slate-100">
                                                            <Globe className="w-10 h-10 text-slate-300" />
                                                        </div>
                                                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-2">Network Initialization</h3>
                                                        <p className="text-slate-500 text-xs font-medium leading-relaxed">
                                                            Institutional nodes are currently undergoing synchronization.
                                                            Telemetry rankings will populate automatically.
                                                        </p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            leaderboard
                                                .filter(item => item.total_energy_kwh > 0)
                                                .map((item, idx) => {
                                                    // Top 3 Badge Logic
                                                    let rankBadge = <span className="text-slate-400 font-mono font-bold">#{idx + 1}</span>;
                                                    if (idx === 0) rankBadge = <div className="bg-slate-900 text-white w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm mx-auto shadow-sm">01</div>;
                                                    if (idx === 1) rankBadge = <div className="bg-slate-100 text-slate-700 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm mx-auto border border-slate-200">02</div>;
                                                    if (idx === 2) rankBadge = <div className="bg-slate-50 text-slate-500 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm mx-auto border border-slate-100">03</div>;

                                                    return (
                                                        <tr key={idx} className="hover:bg-slate-50 transition-colors group">
                                                            <td className="px-8 py-6 text-center">
                                                                {rankBadge}
                                                            </td>
                                                            <td className="px-8 py-6">
                                                                <div className="flex flex-col">
                                                                    <span className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors text-base uppercase tracking-tight">{item.name}</span>
                                                                    <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">West Java Education District</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-6">
                                                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-100 uppercase tracking-widest">
                                                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                                                    Operational
                                                                </div>
                                                            </td>
                                                            <td className="px-8 py-6 font-mono text-slate-900 font-bold text-right text-lg">
                                                                <span>
                                                                    {item.total_energy_kwh.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
                                                                    <span className="text-slate-400 ml-2 text-xs font-bold uppercase">kWh</span>
                                                                </span>
                                                            </td>
                                                            <td className="px-8 py-6 font-mono text-emerald-600 font-bold text-right text-lg">
                                                                <span>
                                                                    {(item.total_energy_kwh * 0.85).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                                                    <span className="text-emerald-400 ml-2 text-xs font-bold uppercase">kg</span>
                                                                </span>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </main>

            <AppFooter />
        </div>
    );
};
