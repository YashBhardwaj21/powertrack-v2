import React, { useEffect, useState } from 'react';
import { Trophy, Leaf, Zap, Globe, ArrowRight, Loader2, Factory, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { fetchPublicLeaderboard, fetchPublicHistory } from '../services/dataService';
import { AppHeader } from '../components/AppHeader';
import { AppFooter } from '../components/AppFooter';
import { PublicEnergyChart } from '../components/PublicEnergyChart';
import { PublicMap } from '../components/PublicMap';


const getWsUrl = () => {
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = '3001';
    return `${protocol}//${host}:${port}`;
};
const WS_URL = getWsUrl();

export const PublicLobby: React.FC = () => {
    const [leaderboard, setLeaderboard] = useState<any[]>([]);
    const [metadata, setMetadata] = useState<{ carbon_intensity_kg_per_kwh: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Graph State
    const [historyData, setHistoryData] = useState<any[]>([]);
    const [graphLoading, setGraphLoading] = useState(true);

    const loadData = async () => {
        try {
            const result = await fetchPublicLeaderboard();
            if (result) {
                setLeaderboard(result.leaderboard);
                setMetadata(result.metadata);
                setError(false);
            } else {
                setError(true);
            }
        } catch (e) {
            console.error(e);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const loadGraphData = async () => {
        // Only show loading spinner on initial load (when data is empty)
        if (historyData.length === 0) {
            setGraphLoading(true);
        }
        try {
            const data = await fetchPublicHistory();
            setHistoryData(data);
        } catch (e) {
            console.error(e);
        } finally {
            // Only clear loading if it was set
            if (historyData.length === 0) {
                setGraphLoading(false);
            }
        }
    };

    useEffect(() => {
        loadData();
        loadGraphData();

        // 🔄 Polling Fallback 
        // 1. Leaderboard: Every 30s (Balanced updates, reduced server load)
        const dataInterval = setInterval(() => {
            loadData();
        }, 30000);

        // 2. Graph: Every 60s (Slow updates to prevent flickering)
        const graphInterval = setInterval(() => {
            loadGraphData();
        }, 60000);

        // Live Sync for Public Lobby (Auto-Reconnecting)
        let ws: WebSocket | null = null;
        let reconnectTimeout: NodeJS.Timeout;

        const connectWebSocket = () => {
            ws = new WebSocket(WS_URL);

            ws.onopen = () => {
                console.log('✅ Public Live Sync Connected');
                ws?.send(JSON.stringify({ type: 'subscribe', schoolId: 'all' }));
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);

                    if (msg.type === 'telemetry_update') {
                        const update = msg.data;
                        // Update leaderboard with real-time values from backend
                        setLeaderboard(prev => prev.map(school => {
                            if (school.school_id === update.school_id) {
                                return {
                                    ...school,
                                    total_energy_kwh: Number(update.total_energy_kwh || 0),
                                    today_energy_kwh: Number(update.daily_energy_kwh || 0),
                                };
                            }
                            return school;
                        }).sort((a, b) => Number(b.total_energy_kwh) - Number(a.total_energy_kwh)));
                    }
                    else if (msg.type === 'school_created') {
                        loadData();
                    }
                } catch (e) {
                    console.error('WS Parse Error', e);
                }
            };

            ws.onclose = () => {
                console.warn('⚠️ Public Live Sync Disconnected. Reconnecting in 3s...');
                reconnectTimeout = setTimeout(connectWebSocket, 3000);
            };

            ws.onerror = (err) => {
                console.error('❌ WS Error:', err);
                ws?.close(); // Ensure onclose is triggered
            };
        };

        connectWebSocket();

        return () => {
            if (ws) ws.close();
            clearTimeout(reconnectTimeout);
            clearInterval(dataInterval);
            clearInterval(graphInterval);
        };
    }, []);

    // Calculate dynamic stats from all schools in leaderboard
    const totalSchools = leaderboard.length;

    const totalEnergy = leaderboard.reduce(
        (sum, school) => sum + Number(school.total_energy_kwh || 0),
        0
    );

    const totalCO2 = metadata?.carbon_intensity_kg_per_kwh
        ? Number((totalEnergy * metadata.carbon_intensity_kg_per_kwh).toFixed(2))
        : 0;


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

                            <h1 className="text-4xl md:text-7xl font-bold text-white leading-tight tracking-tight uppercase">
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
                                        {totalEnergy.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                        <span className="text-xs font-bold opacity-60">kWh</span>
                                    </div>
                                </div>
                                <div className="p-6 rounded-xl bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 shadow-inner">
                                    <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-2">Carbon Offset</div>
                                    <div className="text-3xl font-bold text-blue-400 font-mono">
                                        {totalCO2.toLocaleString(undefined, {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                        <span className="text-xs font-bold opacity-60">kg</span>
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
                        <>

                            <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100 ring-1 ring-slate-900/5 mb-8">
                                {/* Section Header */}
                                <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                                    <div>
                                        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                                            <Trophy className="w-6 h-6 text-yellow-500" />
                                            Sustainability League
                                        </h2>
                                        <p className="text-slate-500 mt-1 text-sm">Real-time performance ranking by energy production.</p>
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
                                                <th className="px-8 py-5 text-right">Specific Yield</th>
                                                <th className="px-8 py-5 text-right">CO₂ Offset</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {leaderboard.length === 0 ? (
                                                <tr>
                                                    <td colSpan={5} className="p-24">
                                                        <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto">
                                                            <div className="bg-slate-50 p-6 rounded-full mb-6 border border-slate-100">
                                                                <Globe className="w-10 h-10 text-slate-300" />
                                                            </div>
                                                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-widest mb-2">
                                                                {error ? "Network Unreachable" : "Network Initialization"}
                                                            </h3>
                                                            <p className="text-slate-500 text-xs font-medium leading-relaxed">
                                                                {error
                                                                    ? "Unable to retrieve telemetry data. Please check your connection."
                                                                    : "Institutional nodes are currently undergoing synchronization. Telemetry rankings will populate automatically."}
                                                            </p>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ) : (
                                                leaderboard
                                                    .map((item, idx) => {
                                                        // Top 3 Badge Logic
                                                        let rankBadge = <span className="text-slate-400 font-mono font-bold">#{idx + 1}</span>;
                                                        if (idx === 0) rankBadge = <div className="bg-slate-900 text-white w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm mx-auto shadow-sm">01</div>;
                                                        if (idx === 1) rankBadge = <div className="bg-slate-100 text-slate-700 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm mx-auto border border-slate-200">02</div>;
                                                        if (idx === 2) rankBadge = <div className="bg-slate-50 text-slate-500 w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm mx-auto border border-slate-100">03</div>;

                                                        return (
                                                            <tr
                                                                key={item.school_id || idx}
                                                                className="hover:bg-slate-50 transition-colors group"
                                                            >
                                                                <td className="px-8 py-6 text-center">
                                                                    {rankBadge}
                                                                </td>
                                                                <td className="px-8 py-6">
                                                                    <div className="flex flex-col">
                                                                        <span className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors text-base uppercase tracking-tight">{item.school_name}</span>

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
                                                                        {Number(item.total_energy_kwh).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                        <span className="text-slate-400 ml-2 text-xs font-bold uppercase">kWh</span>
                                                                    </span>
                                                                </td>
                                                                <td className="px-8 py-6 font-mono text-slate-700 font-bold text-right text-lg">
                                                                    <span>
                                                                        {Number(item.total_capacity_kwp) > 0
                                                                            ? (Number(item.today_energy_kwh || 0) / Number(item.total_capacity_kwp)).toFixed(2)
                                                                            : '0.00'}
                                                                        <span className="text-slate-400 ml-2 text-xs font-bold uppercase">kWh/kWp</span>
                                                                    </span>
                                                                </td>
                                                                <td className="px-8 py-6 font-mono text-emerald-600 font-bold text-right text-lg">
                                                                    <span>
                                                                        {metadata?.carbon_intensity_kg_per_kwh
                                                                            ? (Number(item.total_energy_kwh || 0) * metadata.carbon_intensity_kg_per_kwh).toLocaleString(undefined, {
                                                                                minimumFractionDigits: 2,
                                                                                maximumFractionDigits: 2
                                                                            })
                                                                            : '0.00'
                                                                        }
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




                            {/* Network Power Graph - Below Leaderboard */}
                            <PublicEnergyChart
                                data={historyData}
                                loading={graphLoading}
                                timezone="Asia/Jakarta"
                            />

                            {/* Network Coverage Map - Below Graph */}
                            <PublicMap loading={loading} />
                        </>
                    )}
                </div>
            </main>

            <AppFooter />
        </div>
    );
};
