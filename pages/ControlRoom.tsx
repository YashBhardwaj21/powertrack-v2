
import React, { useState, useEffect, useContext } from 'react';
import { AuthContext } from '../App';
import {
    Activity, Zap, Key, Cpu, Shield,
    TrendingUp, Battery, Terminal, Loader2, Plus, X, Globe, MapPin, DollarSign
} from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts';
import { fetchSchoolLogs, createSchool } from '../services/dataService';

export const ControlRoom: React.FC = () => {
    const auth = useContext(AuthContext);
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddSchool, setShowAddSchool] = useState(false);
    const [newSchool, setNewSchool] = useState({
        name: '',
        type: 'SD',
        district: '',
        latitude: -6.9175,
        longitude: 107.6191,
        total_capacity_kwp: 20.0,
        total_cost_idr: 300000000
    });
    const [creating, setCreating] = useState(false);
    const [createdKey, setCreatedKey] = useState<string | null>(null);

    useEffect(() => {
        if (auth?.user?.school_id) {
            fetchSchoolLogs(auth.user.school_id).then(data => {
                setLogs(data);
                setLoading(false);
            });
        } else {
            setLoading(false);
        }
    }, [auth?.user?.school_id]);

    const handleAddSchool = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);
        try {
            const school = await createSchool(newSchool);
            setCreatedKey(school.api_key);
            // Optionally refresh session or list
        } catch (err: any) {
            alert(err.message);
        } finally {
            setCreating(false);
        }
    };

    if (loading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-blue-600 w-10 h-10" /></div>;

    const current = logs[logs.length - 1] || {};

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 pb-5">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight leading-none uppercase">
                        Platform Administration
                    </h1>
                    <p className="mt-2 text-xs text-slate-500 font-medium">
                        Network management • Node registry • System lifecycle
                    </p>
                </div>
                <div className="flex gap-3">
                    {auth?.user?.role === 'admin' && (
                        <button
                            onClick={() => setShowAddSchool(true)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-sm transition-all flex items-center gap-2 text-xs font-bold uppercase tracking-wider"
                        >
                            <Plus className="w-4 h-4" /> Register Node
                        </button>
                    )}
                </div>
            </header>

            {/* Admin Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Card 1: Hardware Integration Info */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600 border border-blue-100">
                            <Key className="w-5 h-5" />
                        </div>
                        <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Device Configuration</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Assigned School ID</label>
                            <div className="bg-slate-50 p-3 rounded-md border border-slate-200 font-mono text-sm text-slate-700">
                                {auth?.user?.school_id || 'NO SCHOOL ASSIGNED'}
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase block mb-1">Active API Key</label>
                            <div className="bg-slate-50 p-3 rounded-md border border-slate-200 font-mono text-sm flex justify-between items-center group cursor-help relative overflow-hidden">
                                <span className="text-slate-400 select-none group-hover:hidden">••••••••••••••••••••••••••••••••</span>
                                <span className="hidden group-hover:block text-slate-700">{createdKey || 'HIDDEN_FOR_SECURITY'}</span>
                                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">SECURE</span>
                            </div>
                            <p className="text-[10px] text-slate-400 mt-1">* Hover to reveal. Used for ESP32 authentication header `X-API-KEY`.</p>
                        </div>
                    </div>
                </div>

                {/* Card 2: Implementation Reference */}
                <div className="bg-slate-900 p-5 rounded-xl shadow-lg text-white overflow-hidden relative">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4 text-emerald-400">
                            <Terminal className="w-5 h-5" />
                            <h2 className="text-sm font-bold uppercase tracking-wider">Integration Snippet</h2>
                        </div>
                        <div className="bg-black/50 p-4 rounded-lg border border-white/10 font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto scrollbar-hide">
                            <pre>{`// ESP32 Telemetry Logic
HTTPClient http;
http.begin("https://api.powertrack.id/v1/telemetry");
http.addHeader("Content-Type", "application/json");
http.addHeader("X-API-KEY", "YOUR_SCHOOL_API_KEY");

String payload = "{\\"power_w\\": 2420, \\"voltage\\": 220}";
int code = http.POST(payload);
`}</pre>
                        </div>
                    </div>
                    {/* Decorative Blob */}
                    <div className="absolute -top-10 -right-10 w-40 h-40 bg-blue-600/30 rounded-full blur-3xl pointer-events-none" />
                </div>
            </div>

            {/* Add School Modal */}
            {showAddSchool && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                            <h2 className="text-lg font-bold text-slate-800">Register New Node</h2>
                            <button onClick={() => setShowAddSchool(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
                        </div>

                        {!createdKey ? (
                            <form onSubmit={handleAddSchool} className="p-6 space-y-4">
                                <div className="space-y-4">
                                    <div className="space-y-1">
                                        <label className="text-sm font-medium text-slate-700">School Name</label>
                                        <input
                                            type="text" required
                                            className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                            placeholder="e.g. SMAN 1 Bandung"
                                            value={newSchool.name}
                                            onChange={e => setNewSchool({ ...newSchool, name: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-slate-700">District</label>
                                            <input
                                                type="text" required
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                                placeholder="City/Regency"
                                                value={newSchool.district}
                                                onChange={e => setNewSchool({ ...newSchool, district: e.target.value })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-slate-700">Type</label>
                                            <select
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={newSchool.type}
                                                onChange={e => setNewSchool({ ...newSchool, type: e.target.value })}
                                            >
                                                <option value="SD">SD (Primary)</option>
                                                <option value="SMP">SMP (Junior)</option>
                                                <option value="SMA">SMA (Senior)</option>
                                                <option value="Vocational">SMK (Vocational)</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-slate-700">Capacity (kWp)</label>
                                            <input
                                                type="number" step="0.1" required
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={newSchool.total_capacity_kwp}
                                                onChange={e => setNewSchool({ ...newSchool, total_capacity_kwp: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-slate-700">Cost (IDR)</label>
                                            <input
                                                type="number" required
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={newSchool.total_cost_idr}
                                                onChange={e => setNewSchool({ ...newSchool, total_cost_idr: parseInt(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-slate-700">Latitude</label>
                                            <input
                                                type="number" step="0.0001" required
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
                                                value={newSchool.latitude}
                                                onChange={e => setNewSchool({ ...newSchool, latitude: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <label className="text-sm font-medium text-slate-700">Longitude</label>
                                            <input
                                                type="number" step="0.0001" required
                                                className="w-full px-3 py-2 rounded-lg border border-slate-300 outline-none"
                                                value={newSchool.longitude}
                                                onChange={e => setNewSchool({ ...newSchool, longitude: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <button
                                        disabled={creating}
                                        type="submit"
                                        className="w-full bg-blue-600 text-white font-bold py-2.5 rounded-lg shadow-md hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                    >
                                        {creating ? <Loader2 className="animate-spin w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                        Generate API Key
                                    </button>
                                </div>
                            </form>
                        ) : (
                            <div className="p-8 text-center bg-white">
                                <div className="bg-emerald-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Key className="w-8 h-8 text-emerald-600" />
                                </div>
                                <h3 className="text-xl font-bold text-slate-900 mb-2">School Registered!</h3>
                                <p className="text-slate-500 text-sm mb-6">Device credential generated successfully.</p>

                                <div className="bg-slate-900 p-4 rounded-lg font-mono text-emerald-400 break-all border border-slate-800 mb-6 select-all">
                                    {createdKey}
                                </div>

                                <button
                                    onClick={() => {
                                        setShowAddSchool(false);
                                        setCreatedKey(null);
                                        window.location.reload();
                                    }}
                                    className="w-full bg-slate-100 text-slate-700 font-bold py-2.5 rounded-lg hover:bg-slate-200 transition-all"
                                >
                                    Close & Reload
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
