
import React from 'react';
import { FinancialStats } from '../types';
import { DollarSign, TrendingUp, PiggyBank, CalendarClock } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FinancialAnalysisProps {
    stats: FinancialStats;
}

export const FinancialAnalysis: React.FC<FinancialAnalysisProps> = ({ stats }) => {
    
    // Convert to Billions for cleaner display
    const capexB = (stats.total_capex_idr / 1000000000).toFixed(1);
    const savingsB = (stats.total_savings_idr / 1000000000).toFixed(2);
    
    // Data for progress chart
    const data = [
        { name: 'Investment (CAPEX)', amount: stats.total_capex_idr },
        { name: 'Savings To Date', amount: stats.total_savings_idr },
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    Financial Performance & Payback
                </h3>
            </div>
            
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                        <div className="flex items-center gap-1 text-slate-500 text-xs font-bold uppercase">
                            <CalendarClock className="w-3 h-3" /> Payback Period
                        </div>
                        <div className="text-2xl font-bold text-slate-800">{stats.payback_years} <span className="text-sm font-normal text-slate-500">Years</span></div>
                        <div className="text-xs text-slate-400">Estimated based on current rates</div>
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-1 text-slate-500 text-xs font-bold uppercase">
                            <TrendingUp className="w-3 h-3" /> ROI / IRR
                        </div>
                        <div className="text-2xl font-bold text-emerald-600">{stats.irr_percent}%</div>
                        <div className="text-xs text-slate-400">Internal Rate of Return</div>
                    </div>

                    <div className="space-y-1 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-1 text-slate-500 text-xs font-bold uppercase">
                            <PiggyBank className="w-3 h-3" /> LCOE
                        </div>
                        <div className="text-2xl font-bold text-slate-800">Rp {stats.lcoe_idr_per_kwh}</div>
                        <div className="text-xs text-slate-400">Levelized Cost per kWh</div>
                    </div>

                     <div className="space-y-1 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-1 text-slate-500 text-xs font-bold uppercase">
                            <DollarSign className="w-3 h-3" /> Total CAPEX
                        </div>
                        <div className="text-2xl font-bold text-slate-800">Rp {capexB}M</div>
                        <div className="text-xs text-slate-400">Infrastructure Investment</div>
                    </div>
                </div>

                {/* Visual Progress */}
                <div className="flex flex-col justify-center">
                     <div className="h-[180px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} layout="vertical" margin={{left: 40}}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 11}} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(value: number) => `Rp ${(value/1000000).toFixed(0)} M`} cursor={{fill: 'transparent'}} />
                                <Bar dataKey="amount" barSize={30} radius={[0, 4, 4, 0]}>
                                    <Cell fill="#94a3b8" />
                                    <Cell fill="#10b981" />
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                            <span className="font-semibold text-slate-600">Break-even Progress</span>
                            <span className="font-bold text-emerald-600">{stats.payback_progress_percent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                            <div className="bg-emerald-500 h-full transition-all duration-1000" style={{width: `${stats.payback_progress_percent}%`}}></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
