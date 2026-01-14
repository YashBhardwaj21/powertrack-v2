
import React from 'react';
import { StorageStats } from '../types';
import { Database, HardDrive, Clock, Server, FileArchive, Activity } from 'lucide-react';

interface StorageSystemStatusProps {
    stats: StorageStats;
}

export const StorageSystemStatus: React.FC<StorageSystemStatusProps> = ({ stats }) => {
    // Helper to format large numbers
    const formatNumber = (num: number) => {
        if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
        if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
        return num.toString();
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Database className="w-5 h-5 text-indigo-600" />
                    Backend System Status & Storage
                </h3>
                <div className="flex gap-2">
                    <span className="text-[10px] px-2 py-1 bg-green-100 text-green-700 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                        <Activity className="w-3 h-3" /> Healthy
                    </span>
                    <span className="text-[10px] px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full font-bold uppercase tracking-wider">
                        {stats.db_engine}
                    </span>
                </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Metric 1: Total Storage */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                        <HardDrive className="w-4 h-4" /> Storage Usage
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        {stats.storage_usage_mb.toFixed(1)} <span className="text-sm font-normal text-slate-500">MB</span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div className="bg-indigo-500 h-full w-1/4"></div>
                    </div>
                    <p className="text-xs text-slate-400">Compression Ratio: {stats.compression_ratio}x</p>
                </div>

                {/* Metric 2: Data Points */}
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-slate-500 text-sm font-medium">
                        <Server className="w-4 h-4" /> Data Points
                    </div>
                    <div className="text-2xl font-bold text-slate-800">
                        {formatNumber(stats.total_points_stored)}
                    </div>
                     <div className="flex gap-1 h-1.5 w-full">
                        <div className="bg-blue-500 h-full rounded-l-full w-3/4" title="Raw Data"></div>
                        <div className="bg-indigo-300 h-full rounded-r-full w-1/4" title="Aggregated Data"></div>
                    </div>
                    <p className="text-xs text-slate-400">Ingestion: {stats.ingestion_rate_mps} msg/sec</p>
                </div>

                {/* Metric 3: Retention Policy (Raw) */}
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-600 text-sm font-bold">
                        <Clock className="w-4 h-4 text-blue-500" /> Hot Storage (Raw)
                    </div>
                    <div className="text-sm text-slate-700">{stats.retention_policies.raw}</div>
                    <p className="text-[10px] text-slate-400">Full fidelity telemetry retained for debugging and immediate analysis.</p>
                </div>

                {/* Metric 4: Retention Policy (Aggregated) */}
                <div className="space-y-2 bg-slate-50 p-3 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-2 text-slate-600 text-sm font-bold">
                        <FileArchive className="w-4 h-4 text-indigo-500" /> Cold Storage (Agg)
                    </div>
                    <div className="text-sm text-slate-700">{stats.retention_policies.aggregated}</div>
                    <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>Last Rollup Job:</span>
                        <span className="font-mono">{stats.last_rollup_job.split('T')[1].substring(0,5)}</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
