
import React, { useState, useEffect } from 'react';
import { Telemetry, School } from '../types';
import { Gauge, Thermometer, Zap, Activity, Terminal, ChevronUp, Cpu, Eye, EyeOff } from 'lucide-react';
import { MODBUS_REGISTER_MAP, TRANSLATIONS } from '../constants';
import { useDashboard } from '../context/DashboardContext';

interface LiveTelemetryProps {
    data: Telemetry[];
    schools: School[];
}

export const LiveTelemetry: React.FC<LiveTelemetryProps> = ({ data, schools }) => {
    const { locale } = useDashboard();
    const t = TRANSLATIONS[locale];

    // Auto-rotate through schools or pick highest power
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [showDebug, setShowDebug] = useState(false);
    const [mode, setMode] = useState<'exec' | 'eng'>('exec');

    // Rotate selection every 10s if not interacting (simulated kiosk mode)
    useEffect(() => {
        if (!showDebug && mode === 'exec') {
            const interval = setInterval(() => {
                setSelectedIndex(prev => (prev + 1) % schools.length);
            }, 10000);
            return () => clearInterval(interval);
        }
    }, [schools.length, showDebug, mode]);

    const selectedSchool = schools[selectedIndex];
    // Fix: Use selectedSchool.id instead of selectedSchool.school_id
    const telemetry = data.find(d => d.school_id === selectedSchool.id);

    if (!telemetry) return null;

    // Map internal types to the specific MQTT payload requested in spec
    const mqttPayload = {
        ts: telemetry.timestamp,
        school_id: telemetry.school_id,
        power_kw: telemetry.ac_power_kw,
        energy_kwh: telemetry.total_energy_kwh,
        irradiance_wm2: telemetry.irradiance_wm2,
        ac_voltage: telemetry.ac_voltage,
        ac_current: telemetry.ac_current,
        temp_c: telemetry.panel_temp_c,
        fault: telemetry.fault
    };

    return (
        <div className="bg-slate-900 text-white rounded-xl shadow-lg p-4 md:p-6 overflow-hidden relative transition-all duration-300">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500 rounded-full blur-[100px] opacity-10 pointer-events-none"></div>

            <div className="flex flex-col md:flex-row justify-between items-start mb-6 relative z-10 gap-4">
                <div>
                    <h2 className="text-lg font-medium text-slate-300">{t.live_telemetry}</h2>
                    <div className="flex items-center gap-2 mt-1">
                        <select
                            value={selectedIndex}
                            onChange={(e) => setSelectedIndex(Number(e.target.value))}
                            className="bg-slate-800 border border-slate-700 text-white text-xl font-bold rounded px-2 py-1 focus:outline-none focus:border-blue-500"
                        >
                            {schools.map((s, idx) => (
                                <option key={s.id} value={idx}>{s.name}</option>
                            ))}
                        </select>
                        {telemetry.fault !== 'none' && (
                            <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded animate-pulse font-bold">
                                FAULT: {telemetry.fault.toUpperCase()}
                            </span>
                        )}
                    </div>
                </div>
                <div className="text-right flex flex-col items-end">
                    {/* Toggle Mode */}
                    <div className="flex bg-slate-800 p-1 rounded-lg border border-slate-700 mb-2">
                        <button
                            onClick={() => setMode('exec')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${mode === 'exec' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            {t.exec_view}
                        </button>
                        <button
                            onClick={() => setMode('eng')}
                            className={`px-3 py-1 rounded-md text-xs font-medium transition-all flex items-center gap-1 ${mode === 'eng' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Cpu className="w-3 h-3" /> {t.eng_view}
                        </button>
                    </div>

                    {mode === 'eng' && (
                        <>
                            <p className="text-xs text-slate-400 font-mono">MSG_ID: {Date.now().toString().slice(-6)}</p>
                            <div className="flex items-center justify-end gap-2 mt-1">
                                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 font-mono border border-slate-700">QoS: 1</span>
                                <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-emerald-500 font-mono border border-slate-700">TLS: ON</span>
                            </div>
                        </>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 relative z-10">
                {/* AC Power Block */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 relative group">
                    <div className="flex items-center gap-2 text-blue-400 mb-2">
                        <Zap className="w-4 h-4" />
                        <span className="text-xs uppercase font-bold tracking-wider">AC Output</span>
                    </div>
                    <div className="text-2xl font-mono font-bold">{telemetry.ac_power_kw.toFixed(2)} <span className="text-sm text-slate-500">kW</span></div>
                    <div className="w-full bg-slate-700 h-1 mt-2 rounded-full overflow-hidden">
                        <div className="bg-blue-500 h-full transition-all duration-500" style={{ width: `${(telemetry.ac_power_kw / selectedSchool.total_capacity_kwp) * 100}%` }}></div>
                    </div>
                    {mode === 'eng' && <div className="absolute top-2 right-2 text-[9px] text-slate-600 font-mono group-hover:text-blue-300">Reg: 40083</div>}
                </div>

                {/* Voltage/Current Block */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 relative group">
                    <div className="flex items-center gap-2 text-green-400 mb-2">
                        <Activity className="w-4 h-4" />
                        <span className="text-xs uppercase font-bold tracking-wider">Grid</span>
                    </div>
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-sm text-slate-400">V</span>
                        <span className="font-mono font-bold text-lg">{telemetry.ac_voltage.toFixed(1)}</span>
                    </div>
                    <div className="w-full bg-slate-700 h-0.5 mb-2 rounded-full"><div className="bg-green-500 h-full" style={{ width: '98%' }}></div></div>

                    <div className="flex justify-between items-end">
                        <span className="text-sm text-slate-400">A</span>
                        <span className="font-mono font-bold text-lg">{telemetry.ac_current.toFixed(1)}</span>
                    </div>
                    {mode === 'eng' && <div className="absolute top-2 right-2 text-[9px] text-slate-600 font-mono group-hover:text-green-300">Reg: 40071</div>}
                </div>

                {/* Environment Block */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 relative group">
                    <div className="flex items-center gap-2 text-yellow-400 mb-2">
                        <Thermometer className="w-4 h-4" />
                        <span className="text-xs uppercase font-bold tracking-wider">Environment</span>
                    </div>
                    <div className="flex justify-between items-end mb-1">
                        <span className="text-sm text-slate-400">Irr.</span>
                        <span className="font-mono font-bold text-lg">{telemetry.irradiance_wm2} <span className="text-xs">W/m²</span></span>
                    </div>
                    <div className="flex justify-between items-end mt-2">
                        <span className="text-sm text-slate-400">Tmp.</span>
                        <span className="font-mono font-bold text-lg">{telemetry.panel_temp_c.toFixed(1)}°C</span>
                    </div>
                    {mode === 'eng' && <div className="absolute top-2 right-2 text-[9px] text-slate-600 font-mono group-hover:text-yellow-300">Reg: 40107</div>}
                </div>

                {/* Efficiency Block */}
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 relative group">
                    <div className="flex items-center gap-2 text-purple-400 mb-2">
                        <Gauge className="w-4 h-4" />
                        <span className="text-xs uppercase font-bold tracking-wider">Performance</span>
                    </div>
                    <div className="text-center mt-1">
                        <div className="text-2xl font-mono font-bold">{telemetry.performance_ratio.toFixed(1)}%</div>
                        <div className="text-xs text-slate-500 mt-1">Performance Ratio</div>
                    </div>
                    <div className="text-center mt-2 border-t border-slate-700 pt-2">
                        <span className="text-xs text-slate-400">Inv. Eff: </span>
                        <span className="text-sm font-mono text-white">{telemetry.efficiency_percent}%</span>
                    </div>
                    {mode === 'eng' && <div className="absolute top-2 right-2 text-[9px] text-slate-600 font-mono group-hover:text-purple-300">Calc</div>}
                </div>
            </div>

            {/* Debug Payload View (Engineer Mode Only) */}
            {mode === 'eng' && (
                <div className="mt-4">
                    <button
                        onClick={() => setShowDebug(!showDebug)}
                        className="text-xs flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"
                    >
                        {showDebug ? <ChevronUp className="w-3 h-3" /> : <Terminal className="w-3 h-3" />}
                        {showDebug ? 'Hide Payload' : 'View Raw MQTT & Modbus Map'}
                    </button>

                    {showDebug && (
                        <div className="mt-2 pt-4 border-t border-slate-700 animate-in slide-in-from-top-2 duration-200">
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Terminal className="w-4 h-4 text-emerald-500" />
                                            <span className="text-xs font-mono text-emerald-400">INCOMING PACKET (TCP/8883)</span>
                                        </div>
                                    </div>
                                    <div className="bg-black/50 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-x-auto border border-slate-800 h-48 custom-scrollbar">
                                        <pre>{JSON.stringify(mqttPayload, null, 2)}</pre>
                                    </div>
                                </div>
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Cpu className="w-4 h-4 text-purple-500" />
                                            <span className="text-xs font-mono text-purple-400">SUNSPEC REGISTER MAP</span>
                                        </div>
                                    </div>
                                    <div className="bg-black/50 rounded-lg p-3 font-mono text-xs text-slate-300 overflow-y-auto border border-slate-800 h-48 custom-scrollbar">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="border-b border-slate-700 text-slate-500">
                                                    <th className="pb-1">Reg</th>
                                                    <th className="pb-1">Name</th>
                                                    <th className="pb-1">Type</th>
                                                    <th className="pb-1">Unit</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {Object.entries(MODBUS_REGISTER_MAP).map(([reg, meta]) => {
                                                    const m = meta as { name: string; type: string; unit?: string };
                                                    return (
                                                        <tr key={reg} className="border-b border-slate-800/50">
                                                            <td className="py-1 text-purple-300">{reg}</td>
                                                            <td className="py-1 text-slate-300">{m.name}</td>
                                                            <td className="py-1 text-slate-500">{m.type}</td>
                                                            <td className="py-1 text-slate-500">{m.unit || '-'}</td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
