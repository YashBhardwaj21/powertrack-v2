import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Brush, Legend } from 'recharts';
import { Activity, Zap, Info } from 'lucide-react';
import { formatTimeInSchoolTZ } from '../utils/timezone';

interface PublicEnergyChartProps {
    data: any[];
    loading: boolean;
    timezone?: string; // School's IANA timezone
}

// Fixed color palette for schools
const COLORS = [
    '#10b981', // Emerald 500
    '#3b82f6', // Blue 500
    '#f59e0b', // Amber 500
    '#8b5cf6', // Violet 500
    '#ec4899', // Pink 500
    '#06b6d4', // Cyan 500
    '#f97316', // Orange 500
    '#6366f1', // Indigo 500
    '#14b8a6', // Teal 500
    '#d946ef', // Fuchsia 500
];

export const PublicEnergyChart: React.FC<PublicEnergyChartProps> = ({ data, loading, timezone = 'Asia/Jakarta' }) => {
    // Extract school names from first data point keys, excluding 'timestamp'
    const schoolNames = data.length > 0
        ? Object.keys(data[0]).filter(key => key !== 'timestamp')
        : [];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            // Sort payload by value desc
            const sorted = [...payload].sort((a, b) => b.value - a.value);

            return (
                <div className="bg-slate-900/95 text-white p-4 rounded-lg shadow-xl border border-slate-700 max-w-[280px]">
                    <p className="text-slate-400 text-xs mb-3 font-mono border-b border-slate-800 pb-2">
                        {formatTimeInSchoolTZ(label, timezone)} ({new Date(label).toLocaleDateString('en-US', { weekday: 'short', timeZone: timezone })})
                    </p>
                    <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                        {sorted.map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between gap-4 text-xs">
                                <span className="flex items-center gap-2 truncate text-slate-300">
                                    <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    {item.name}
                                </span>
                                <span className="font-mono font-bold text-white">
                                    {Number(item.value).toFixed(2)} kW
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white rounded-2xl shadow-2xl shadow-slate-200/50 overflow-hidden border border-slate-100 ring-1 ring-slate-900/5 mb-8">
            <div className="p-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white">
                <div>
                    <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                        <Activity className="w-6 h-6 text-emerald-500" />
                        Network Power Generation Profile
                    </h2>
                    <p className="text-slate-500 mt-1 text-sm">
                        Real-time instantaneous power readings (kW) for all connected institutions (24-hour window)
                    </p>
                </div>
                <div className="flex items-center gap-2 text-xs font-medium text-slate-400 bg-slate-50 px-3 py-1.5 rounded-md">
                    <Info className="w-3.5 h-3.5" />
                    Hover over chart for details
                </div>
            </div>

            <div className="p-6 h-[500px] w-full bg-slate-50/50 relative">
                {/* CSS for custom scrollbar in tooltip */}
                <style>{`
                    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
                    .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
                    .custom-scrollbar::-webkit-scrollbar-thumb { background: #475569; border-radius: 2px; }
                 `}</style>

                {loading ? (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 animate-pulse gap-4">
                        <Activity className="w-8 h-8 opacity-50" />
                        <span>Synchronizing telemetry streams...</span>
                    </div>
                ) : data.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-slate-400">
                        No telemetry data available for this period.
                    </div>
                ) : (
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                                dataKey="timestamp"
                                tickFormatter={(str) => formatTimeInSchoolTZ(str, timezone)}
                                stroke="#94a3b8"
                                fontSize={11}
                                tickMargin={10}
                                minTickGap={50}
                            />
                            <YAxis
                                stroke="#94a3b8"
                                fontSize={11}
                                tickFormatter={(val) => `${val} kW`}
                                width={60}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend
                                wrapperStyle={{ fontSize: '12px', paddingTop: '20px' }}
                                iconType="circle"
                            />

                            {schoolNames.map((school, index) => (
                                <Line
                                    key={school}
                                    type="monotone"
                                    dataKey={school}
                                    stroke={COLORS[index % COLORS.length]}
                                    strokeWidth={2}
                                    dot={false}
                                    activeDot={{ r: 4, strokeWidth: 0 }}
                                    animationDuration={1500}
                                    connectNulls
                                />
                            ))}

                            <Brush
                                dataKey="timestamp"
                                height={30}
                                stroke="#cbd5e1"
                                fill="#f8fafc"
                                tickFormatter={() => ''}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )}
            </div>
        </div>
    );
};
