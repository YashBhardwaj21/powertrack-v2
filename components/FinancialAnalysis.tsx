
import React from 'react';
import { FinancialStats } from '../types';
import { DollarSign, TrendingUp, PiggyBank, CalendarClock, Info } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { formatCurrency } from '../utils/formatters';

interface FinancialAnalysisProps {
    stats: FinancialStats;
}

export const FinancialAnalysis: React.FC<FinancialAnalysisProps> = ({ stats }) => {

    // Safety checks and Clamping
    const paybackYears = stats.payback_years > 30 || !isFinite(stats.payback_years) || stats.payback_years < 0 ? '> 25' : stats.payback_years.toFixed(1);
    const progressPercent = Math.min(100, Math.max(0, stats.payback_progress_percent));

    // Format large numbers for display (M = Million, B = Billion)
    const formatLargeMoney = (val: number) => {
        if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)}B`;
        if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)}M`;
        return formatCurrency(val);
    };

    // Data for progress chart
    const data = [
        { name: 'Investment (CAPEX)', amount: stats.total_capex_idr, color: '#94a3b8' },
        { name: 'Savings To Date', amount: stats.total_savings_idr, color: '#10b981' },
    ];

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-emerald-600" />
                    Financial Performance & Payback
                </h3>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Payback Period */}
                    <div className="space-y-1 group relative">
                        <div className="flex items-center gap-1 text-slate-500 text-xs font-bold uppercase cursor-help">
                            <CalendarClock className="w-3 h-3" /> Payback Period
                            <Info className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-2xl font-bold text-slate-800">{paybackYears} <span className="text-sm font-normal text-slate-500">Years</span></div>
                        <div className="text-xs text-slate-400">Estimated time to break-even</div>
                        {/* Tooltip */}
                        <div className="absolute top-0 left-0 -mt-16 hidden group-hover:block bg-slate-800 text-white text-xs p-2 rounded z-10 w-48 shadow-lg">
                            Time required to recover the cost of investment through energy savings.
                        </div>
                    </div>

                    {/* IRR */}
                    <div className="space-y-1 group relative">
                        <div className="flex items-center gap-1 text-slate-500 text-xs font-bold uppercase cursor-help">
                            <TrendingUp className="w-3 h-3" /> IRR
                            <Info className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="text-2xl font-bold text-emerald-600">{stats.irr_percent.toFixed(1)}%</div>
                        <div className="text-xs text-slate-400">Internal Rate of Return</div>
                        {/* Tooltip */}
                        <div className="absolute top-0 left-0 -mt-16 hidden group-hover:block bg-slate-800 text-white text-xs p-2 rounded z-10 w-48 shadow-lg">
                            Annualized effective compounded return rate. 12%+ is considered excellent for solar.
                        </div>
                    </div>

                    {/* LCOE */}
                    <div className="space-y-1 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-1 text-slate-500 text-xs font-bold uppercase">
                            <PiggyBank className="w-3 h-3" /> LCOE
                        </div>
                        <div className="text-2xl font-bold text-slate-800">{formatCurrency(stats.lcoe_idr_per_kwh)}</div>
                        <div className="text-xs text-slate-400">Levelized Cost per kWh</div>
                    </div>

                    {/* Total CAPEX */}
                    <div className="space-y-1 pt-4 border-t border-slate-100">
                        <div className="flex items-center gap-1 text-slate-500 text-xs font-bold uppercase">
                            <DollarSign className="w-3 h-3" /> Total CAPEX
                        </div>
                        <div className="text-2xl font-bold text-slate-800">{formatLargeMoney(stats.total_capex_idr)}</div>
                        <div className="text-xs text-slate-400">Infrastructure Investment</div>
                    </div>
                </div>

                {/* Visual Progress */}
                <div className="flex flex-col justify-center">
                    <div className="h-[180px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={data} layout="vertical" margin={{ left: 40, right: 20 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={110} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} />
                                <Tooltip formatter={(value: number) => formatLargeMoney(value)} cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                                <Bar dataKey="amount" barSize={32} radius={[0, 4, 4, 0]}>
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 px-2">
                        <div className="flex justify-between text-xs mb-1.5 align-bottom">
                            <span className="font-semibold text-slate-600">Break-even Progress</span>
                            <span className="font-bold text-emerald-600 text-sm">{progressPercent.toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                            <div className="bg-emerald-500 h-full transition-all duration-1000 ease-out" style={{ width: `${progressPercent}%` }}></div>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-2 text-right">
                            {progressPercent < 100 ? 'Investment recovery in progress' : 'Investment fully recovered'}
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};
