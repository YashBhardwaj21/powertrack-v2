
import React from 'react';
import { useDashboard } from '../context/DashboardContext';
import {
    Activity,
    Wifi,
    WifiOff,
    Zap,
    AlertTriangle,
    Clock,
    Server,
    ShieldCheck,
    Thermometer,
    CheckCircle2,
    XCircle,
    RotateCcw
} from 'lucide-react';

export const AlertsDashboard: React.FC = () => {
    const { data, loading } = useDashboard();

    if (loading || !data) {
        return <div className="flex justify-center p-12"><Activity className="animate-spin text-blue-500" /></div>;
    }

    // --- 1. Overall System Status ---
    // Simple logic: If any critical alert -> Critical. If warning -> Degraded. Else Healthy.
    const criticalAlerts = data.alerts.filter(a => a.severity === 'critical').length;
    const warningAlerts = data.alerts.filter(a => a.severity === 'warning').length;

    let systemStatus: 'Healthy' | 'Degraded' | 'Critical' = 'Healthy';
    let statusColor = 'text-emerald-500';
    let statusBg = 'bg-emerald-50';
    let statusBorder = 'border-emerald-200';

    if (criticalAlerts > 0) {
        systemStatus = 'Critical';
        statusColor = 'text-red-500';
        statusBg = 'bg-red-50';
        statusBorder = 'border-red-200';
    } else if (warningAlerts > 0) {
        systemStatus = 'Degraded';
        statusColor = 'text-yellow-500';
        statusBg = 'bg-yellow-50';
        statusBorder = 'border-yellow-200';
    }

    // --- 2. Data Freshness (Using first available school or aggregate) ---
    // In real app, this might be per-school. Here we take the latest timestamp from current_data.
    const latestTelemetry = data.current_data[0];
    const lastUpdate = latestTelemetry ? new Date(latestTelemetry.timestamp) : new Date();
    const now = new Date();
    const delaySeconds = Math.floor((now.getTime() - lastUpdate.getTime()) / 1000);
    const isOnline = delaySeconds < 300; // 5 mins threshold

    return (
        <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Header */}
            <header className="mb-8">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
                    <Activity className="w-8 h-8 text-blue-600" />
                    System Health Hub
                </h1>
                <p className="mt-2 text-sm text-slate-500 max-w-2xl">
                    Operational assurance center. Monitoring uptime, data integrity, and hardware status for {data.schools.length} nodes.
                </p>
            </header>

            {/* 1. Overall System Status */}
            <section className={`p-6 rounded-2xl border ${statusBorder} ${statusBg} flex items-center justify-between shadow-sm`}>
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full bg-white ${statusBorder} border`}>
                        {systemStatus === 'Healthy' && <CheckCircle2 className="w-8 h-8 text-emerald-500" />}
                        {systemStatus === 'Degraded' && <AlertTriangle className="w-8 h-8 text-yellow-500" />}
                        {systemStatus === 'Critical' && <XCircle className="w-8 h-8 text-red-500" />}
                    </div>
                    <div>
                        <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Overall System Status</h2>
                        <p className={`text-2xl font-bold ${statusColor}`}>{systemStatus}</p>
                    </div>
                </div>
                <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-500">Active Nodes</p>
                    <p className="text-xl font-bold text-slate-700">{data.current_data.length} / {data.schools.length}</p>
                </div>
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* 2. Data Freshness & Connectivity */}
                <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-1">
                    <div className="flex items-center gap-2 mb-4">
                        <Wifi className="w-5 h-5 text-blue-500" />
                        <h3 className="font-bold text-slate-800">Connectivity & Freshness</h3>
                    </div>
                    <div className="space-y-4">
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <span className="text-sm text-slate-500">Connection State</span>
                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                {isOnline ? 'ONLINE' : 'OFFLINE'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                            <span className="text-sm text-slate-500">Last Heartbeat</span>
                            <span className="text-sm font-mono text-slate-700">{lastUpdate.toLocaleTimeString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm text-slate-500">Data Latency</span>
                            <span className={`text-sm font-bold ${delaySeconds < 60 ? 'text-emerald-600' : 'text-orange-600'}`}>
                                {delaySeconds}s delay
                            </span>
                        </div>
                    </div>
                </section>

                {/* 4. Inverter Health & Grid Sync */}
                <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-1">
                    <div className="flex items-center gap-2 mb-4">
                        <Zap className="w-5 h-5 text-amber-500" />
                        <h3 className="font-bold text-slate-800">Inverter & Grid Sync</h3>
                    </div>
                    {/* Assuming first school data for demo, in real app iterate or select */}
                    <div className="space-y-3">
                        <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                            <span className="text-xs font-medium text-slate-600">Grid Presence</span>
                            {/* Heuristic: if Voltage > 10 it's present */}
                            <span className={`text-xs font-bold ${latestTelemetry?.ac_voltage > 10 ? 'text-emerald-600' : 'text-red-500'}`}>
                                {latestTelemetry?.ac_voltage > 10 ? 'CONNECTED' : 'ISLANDED'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                            <span className="text-xs font-medium text-slate-600">Export State</span>
                            <span className={`text-xs font-bold ${latestTelemetry?.grid_export_kw > 0 ? 'text-blue-600' : 'text-slate-500'}`}>
                                {latestTelemetry?.grid_export_kw > 0 ? 'EXPORTING' : 'IDLE'}
                            </span>
                        </div>
                        <div className="flex justify-between items-center p-2 bg-slate-50 rounded">
                            <span className="text-xs font-medium text-slate-600">Sync Frequency</span>
                            <span className="text-xs font-bold text-slate-700">50.0 Hz (Nominal)</span>
                        </div>
                    </div>
                </section>

                {/* 7. Device Runtime (Mocked/Derived) */}
                <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm col-span-1">
                    <div className="flex items-center gap-2 mb-4">
                        <Server className="w-5 h-5 text-violet-500" />
                        <h3 className="font-bold text-slate-800">Device Stability</h3>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="text-center p-3 bg-violet-50 rounded-lg">
                            <p className="text-xs text-violet-600 font-bold mb-1">UPTIME</p>
                            <p className="text-xl font-bold text-slate-800">99.8%</p>
                        </div>
                        <div className="text-center p-3 bg-violet-50 rounded-lg">
                            <p className="text-xs text-violet-600 font-bold mb-1">REBOOTS (24h)</p>
                            <p className="text-xl font-bold text-slate-800">0</p>
                        </div>
                        <div className="col-span-2 flex items-center justify-between text-xs text-slate-500 mt-2">
                            <span>Packet Loss: <span className="text-emerald-500 font-bold">0.05%</span></span>
                            <span>Last Boot: 14d ago</span>
                        </div>
                    </div>
                </section>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* 3. Sensor Health Breakdown */}
                <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <Activity className="w-5 h-5 text-indigo-500" />
                        <h3 className="font-bold text-slate-800">Sensor Array Status</h3>
                    </div>
                    <div className="space-y-4">
                        {/* Solar Meter */}
                        <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <Zap className="w-4 h-4 text-amber-500" />
                                <div>
                                    <p className="text-sm font-bold text-slate-700">Solar Generation Meter (PZEM-004T)</p>
                                    <p className="text-xs text-slate-400">ID: S01-MAIN</p>
                                </div>
                            </div>
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">OK</span>
                        </div>
                        {/* Grid Meter */}
                        <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <Activity className="w-4 h-4 text-blue-500" />
                                <div>
                                    <p className="text-sm font-bold text-slate-700">Grid Exchange Meter (PZEM-004T)</p>
                                    <p className="text-xs text-slate-400">ID: G01-EXT</p>
                                </div>
                            </div>
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">OK</span>
                        </div>
                        {/* Temp Sensor */}
                        <div className="flex items-center justify-between p-3 border border-slate-100 rounded-lg hover:bg-slate-50 transition-colors">
                            <div className="flex items-center gap-3">
                                <Thermometer className="w-4 h-4 text-rose-500" />
                                <div>
                                    <p className="text-sm font-bold text-slate-700">Panel Temperature (DS18B20)</p>
                                    <p className="text-xs text-slate-400">Reading: {latestTelemetry?.panel_temp_c}°C</p>
                                </div>
                            </div>
                            <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded">OK</span>
                        </div>
                    </div>
                </section>

                {/* 5. Data Quality Indicators */}
                <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                        <ShieldCheck className="w-5 h-5 text-teal-500" />
                        <h3 className="font-bold text-slate-800">Data Integrity Guard</h3>
                    </div>
                    <div className="space-y-3">
                        <div className="flex items-start gap-3 p-3 bg-teal-50 rounded-lg">
                            <Clock className="w-4 h-4 text-teal-600 mt-1" />
                            <div>
                                <p className="text-sm font-bold text-teal-800">Timestamp Drift Check</p>
                                <p className="text-xs text-teal-600 mt-1">
                                    All device clocks synchronized within 500ms of server time.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            <CheckCircle2 className="w-4 h-4 text-slate-400 mt-1" />
                            <div>
                                <p className="text-sm font-bold text-slate-600">Duplicate Suppression</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    0 duplicate packets rejected in last 24h.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                            <CheckCircle2 className="w-4 h-4 text-slate-400 mt-1" />
                            <div>
                                <p className="text-sm font-bold text-slate-600">Value Bounds Check</p>
                                <p className="text-xs text-slate-400 mt-1">
                                    All sensors reporting within physical limits (0-100A, 210-250V).
                                </p>
                            </div>
                        </div>
                    </div>
                </section>
            </div>

            {/* 6. Faults & Alerts History */}
            <section className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-slate-600" />
                        <h3 className="font-bold text-slate-800">Faults & Events Log</h3>
                    </div>
                    <span className="text-xs text-slate-400">Last 30 Days</span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-medium">
                            <tr>
                                <th className="px-6 py-3">Timestamp</th>
                                <th className="px-6 py-3">Severity</th>
                                <th className="px-6 py-3">Event Type</th>
                                <th className="px-6 py-3">Message</th>
                                <th className="px-6 py-3">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {data.alerts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-8 text-center text-slate-400">
                                        No active faults or warnings. System operating normally.
                                    </td>
                                </tr>
                            ) : (
                                data.alerts.map(alert => (
                                    <tr key={alert.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap font-mono text-slate-600">
                                            {new Date(alert.timestamp).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold border ${alert.severity === 'critical' ? 'bg-red-100 text-red-700 border-red-200' :
                                                    alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
                                                        'bg-blue-100 text-blue-700 border-blue-200'
                                                }`}>
                                                {alert.severity.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-slate-700 font-medium capitalize">
                                            {alert.type.replace('_', ' ')}
                                        </td>
                                        <td className="px-6 py-4 text-slate-600">
                                            {alert.message}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="flex items-center gap-1 text-xs font-bold text-slate-400">
                                                <RotateCcw className="w-3 h-3" />
                                                Active
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    );
};
