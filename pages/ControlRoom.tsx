
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
        <div className="space-y-8 py-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-900 p-8 rounded-2xl text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 text-blue-400 mb-2">
                        <Shield className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-widest">Secure Control Room</span>
                    </div>
                    <h1 className="text-3xl font-bold">{auth?.user?.school?.name || 'PowerTrack Admin'}</h1>
                    <p className="text-slate-400 mt-1">Authorized {auth?.user?.role === 'admin' ? 'System' : 'School'} Admin: {auth?.user?.email}</p>
                </div>
                <div className="flex gap-3 relative z-10">
                    {auth?.user?.role === 'admin' && (
                        <button
                            onClick={() => setShowAddSchool(true)}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-bold transition-all flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Add New School
                        </button>
                    )}
                    <button
                        onClick={() => auth?.logout()}
                        className="px-6 py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-bold transition-all"
                    >
                        System Logout
                    </button>
                </div>
            </div>

            {/* Statistics Row */}
            {auth?.user?.school_id ? (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white">
                            <div className="flex items-center gap-2 text-yellow-500 mb-4">
                                <Zap className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Real-time Power</span>
                            </div>
                            <div className="text-3xl font-mono font-bold">{(current.ac_power_kw || 0).toFixed(2)} <span className="text-sm font-normal text-slate-500">kW</span></div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white">
                            <div className="flex items-center gap-2 text-blue-400 mb-4">
                                <Activity className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Grid Voltage</span>
                            </div>
                            <div className="text-3xl font-mono font-bold">{(current.ac_voltage || 0).toFixed(1)} <span className="text-sm font-normal text-slate-500">V</span></div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white">
                            <div className="flex items-center gap-2 text-emerald-400 mb-4">
                                <TrendingUp className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Current</span>
                            </div>
                            <div className="text-3xl font-mono font-bold">{(current.ac_current || 0).toFixed(1)} <span className="text-sm font-normal text-slate-500">A</span></div>
                        </div>
                        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl text-white">
                            <div className="flex items-center gap-2 text-purple-400 mb-4">
                                <Battery className="w-4 h-4" />
                                <span className="text-xs font-bold uppercase">Today's Yield</span>
                            </div>
                            <div className="text-3xl font-mono font-bold">{(current.daily_energy_kwh || 0).toFixed(1)} <span className="text-sm font-normal text-slate-500">kWh</span></div>
                        </div>
                    </div>

                    <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
                        <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                            <Activity className="text-blue-600" /> Power Generation History
                        </h2>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={logs}>
                                    <defs>
                                        <linearGradient id="colorP" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <XAxis dataKey="timestamp" hide />
                                    <YAxis hide />
                                    <Tooltip />
                                    <Area type="monotone" dataKey="ac_power_kw" stroke="#3b82f6" strokeWidth={3} fill="url(#colorP)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            ) : (
                <div className="bg-blue-50 border border-blue-100 p-12 rounded-2xl text-center">
                    <Globe className="w-16 h-16 text-blue-500 mx-auto mb-4 opacity-50" />
                    <h2 className="text-xl font-bold text-blue-900">System Initialized</h2>
                    <p className="text-blue-700 mt-2 max-w-md mx-auto">
                        Welcome to {auth?.user?.full_name}'s Control Room. You haven't added any schools to your network yet.
                    </p>
                    {auth?.user?.role === 'admin' && (
                        <button
                            onClick={() => setShowAddSchool(true)}
                            className="mt-6 bg-blue-600 text-white font-bold px-8 py-3 rounded-lg shadow-lg hover:bg-blue-700 transition-all"
                        >
                            Add Your First School
                        </button>
                    )}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Key className="text-blue-600" /> Hardware Integration
                    </h2>
                    <div className="space-y-4">
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-sm break-all">
                            <span className="text-slate-400 block mb-1 text-[10px] uppercase font-bold">School ID (school_id)</span>
                            {auth?.user?.school_id || 'SELECT A SCHOOL'}
                        </div>
                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 font-mono text-sm break-all relative group">
                            <span className="text-slate-400 block mb-1 text-[10px] uppercase font-bold text-amber-600">Private API Key (X-API-KEY)</span>
                            <div className="flex items-center justify-between">
                                <span className="blur-sm group-hover:blur-none transition-all duration-300">
                                    {createdKey || '••••••••••••••••••••••••••••••••'}
                                </span>
                                <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">TOP SECRET</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-slate-500 italic">
                        *Hover over the API key to reveal it. Use this key in your ESP32 headers as `X-API-KEY`.
                    </p>
                </div>

                <div className="bg-slate-900 p-8 rounded-2xl text-white space-y-6 overflow-hidden relative shadow-2xl">
                    <div className="flex items-center gap-2 text-emerald-400">
                        <Terminal className="w-5 h-5" />
                        <h2 className="text-lg font-bold">ESP32 Code Snippet</h2>
                    </div>
                    <div className="bg-black/50 p-4 rounded-xl border border-white/5 font-mono text-[11px] leading-relaxed text-slate-300 overflow-x-auto">
                        <pre>{`// Real Production Integration
HTTPClient http;
http.begin("http://your-server/api/v1/telemetry/ingest");
http.addHeader("Content-Type", "application/json");
http.addHeader("X-API-KEY", "${createdKey || 'YOUR_KEY_HERE'}");

String payload = "{\\"power_w\\": 2420, \\"voltage\\": 231, \\"current_a\\": 10.5}";
int httpResponseCode = http.POST(payload);

if (httpResponseCode > 0) {
    Serial.print("Success: ");
    Serial.println(httpResponseCode);
}
http.end();`}</pre>
                    </div>
                </div>
            </div>

            {/* Add School Modal */}
            {showAddSchool && (
                <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden scale-in">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-blue-600 text-white">
                            <h2 className="text-xl font-bold">Register New School Installation</h2>
                            <button onClick={() => setShowAddSchool(false)}><X /></button>
                        </div>

                        {!createdKey ? (
                            <form onSubmit={handleAddSchool} className="p-8 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="col-span-2 space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase">School Name</label>
                                        <input
                                            type="text" required
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="SDN Example 1"
                                            value={newSchool.name}
                                            onChange={e => setNewSchool({ ...newSchool, name: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase">District</label>
                                        <input
                                            type="text" required
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 focus:ring-2 focus:ring-blue-500 outline-none"
                                            placeholder="Bandung Barat"
                                            value={newSchool.district}
                                            onChange={e => setNewSchool({ ...newSchool, district: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Type</label>
                                        <select
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 bg-white"
                                            value={newSchool.type}
                                            onChange={e => setNewSchool({ ...newSchool, type: e.target.value })}
                                        >
                                            <option value="SD">SD</option>
                                            <option value="SMP">SMP</option>
                                            <option value="SMA">SMA</option>
                                            <option value="Vocational">Vocational</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Capacity (kWp)</label>
                                        <div className="relative">
                                            <Zap className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input
                                                type="number" step="0.1" required
                                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none"
                                                value={newSchool.total_capacity_kwp}
                                                onChange={e => setNewSchool({ ...newSchool, total_capacity_kwp: parseFloat(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Estimated Cost (IDR)</label>
                                        <div className="relative">
                                            <DollarSign className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                                            <input
                                                type="number" required
                                                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 outline-none"
                                                value={newSchool.total_cost_idr}
                                                onChange={e => setNewSchool({ ...newSchool, total_cost_idr: parseInt(e.target.value) })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Latitude</label>
                                        <input
                                            type="number" step="0.0001" required
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none"
                                            value={newSchool.latitude}
                                            onChange={e => setNewSchool({ ...newSchool, latitude: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Longitude</label>
                                        <input
                                            type="number" step="0.0001" required
                                            className="w-full px-4 py-2 rounded-lg border border-slate-200 outline-none"
                                            value={newSchool.longitude}
                                            onChange={e => setNewSchool({ ...newSchool, longitude: parseFloat(e.target.value) })}
                                        />
                                    </div>
                                </div>

                                <button
                                    disabled={creating}
                                    type="submit"
                                    className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                                >
                                    {creating ? <Loader2 className="animate-spin" /> : <Globe className="w-5 h-5" />}
                                    Onboard School Location
                                </button>
                            </form>
                        ) : (
                            <div className="p-12 text-center space-y-6">
                                <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                                    <Shield className="w-10 h-10 text-emerald-600" />
                                </div>
                                <div>
                                    <h3 className="text-2xl font-bold text-slate-900">Success! API Key Generated</h3>
                                    <p className="text-slate-500 mt-2">Use this key to authenticate your ESP32 hardware device.</p>
                                </div>
                                <div className="bg-slate-900 p-6 rounded-2xl font-mono text-emerald-400 break-all border-4 border-emerald-500/20">
                                    {createdKey}
                                </div>
                                <div className="bg-amber-50 border border-amber-100 p-4 rounded-xl flex gap-3 text-left">
                                    <Shield className="text-amber-600 w-6 h-6 flex-shrink-0" />
                                    <p className="text-xs text-amber-800 leading-relaxed font-bold">
                                        WARNING: Copy this key now! This is the only time it will be shown in full. If lost, it must be regenerated by a system admin.
                                    </p>
                                </div>
                                <button
                                    onClick={() => {
                                        setShowAddSchool(false);
                                        setCreatedKey(null);
                                        window.location.reload(); // Refresh to show new school if applicable
                                    }}
                                    className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 transition-all"
                                >
                                    Got it, Close
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
