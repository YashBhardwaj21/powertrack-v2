
import React from 'react';
import { CommunityStats } from '../types';
import { Share2, BatteryCharging, ArrowUpRight, ArrowDownLeft } from 'lucide-react';

interface CommunityEnergyProps {
    stats: CommunityStats;
}

export const CommunityEnergy: React.FC<CommunityEnergyProps> = ({ stats }) => {
    return (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-xl shadow-lg text-white overflow-hidden relative">
            {/* Abstract Background */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-white opacity-5 rounded-full blur-2xl transform translate-x-10 -translate-y-10"></div>
            
            <div className="p-6 relative z-10">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            <Share2 className="w-5 h-5 text-purple-200" />
                            Community Energy Sharing
                        </h3>
                        <p className="text-indigo-200 text-xs mt-1">Virtual Power Plant (VPP) Simulation</p>
                    </div>
                    <span className="bg-white/10 px-2 py-1 rounded text-xs font-mono backdrop-blur-sm border border-white/10">
                        {stats.active_peers} Active Peers
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-6 mb-6">
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/5">
                        <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase mb-1">
                            <ArrowUpRight className="w-4 h-4" /> Surplus (Supply)
                        </div>
                        <div className="text-2xl font-bold">{stats.total_surplus_kw} <span className="text-sm font-normal text-indigo-200">kW</span></div>
                    </div>
                    <div className="bg-white/10 rounded-lg p-3 backdrop-blur-sm border border-white/5">
                        <div className="flex items-center gap-2 text-orange-300 text-xs font-bold uppercase mb-1">
                            <ArrowDownLeft className="w-4 h-4" /> Deficit (Demand)
                        </div>
                        <div className="text-2xl font-bold">{stats.total_deficit_kw} <span className="text-sm font-normal text-indigo-200">kW</span></div>
                    </div>
                </div>

                {/* Net Flow Visualization */}
                <div className="bg-black/20 rounded-lg p-4">
                    <div className="flex justify-between items-center mb-2">
                         <span className="text-xs text-indigo-200">Net Grid Flow</span>
                         <span className="text-xs font-bold">{stats.net_grid_flow_kw > 0 ? 'Exporting' : 'Importing'}</span>
                    </div>
                    <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                        <div className="absolute top-0 bottom-0 w-0.5 bg-white left-1/2 z-10 opacity-50"></div>
                        <div 
                            className={`absolute top-0 bottom-0 transition-all duration-500 ${stats.net_grid_flow_kw > 0 ? 'left-1/2 bg-emerald-400' : 'right-1/2 bg-orange-400'}`}
                            style={{
                                width: `${Math.min(50, (Math.abs(stats.net_grid_flow_kw) / 100) * 50)}%`, // Simplified scaling
                                [stats.net_grid_flow_kw > 0 ? 'left' : 'right']: '50%'
                            }}
                        ></div>
                    </div>
                    <div className="flex justify-between mt-1 text-[10px] text-white/40 font-mono">
                        <span>Import</span>
                        <span>0</span>
                        <span>Export</span>
                    </div>
                </div>

                <div className="mt-4 pt-4 border-t border-white/10 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <BatteryCharging className="w-4 h-4 text-yellow-300" />
                        <span className="text-sm font-medium">Potential Shared Value</span>
                    </div>
                    <div className="font-bold text-lg">Rp {stats.sharing_potential_idr.toLocaleString()} <span className="text-xs font-normal opacity-70">/hr</span></div>
                </div>
            </div>
        </div>
    );
};
