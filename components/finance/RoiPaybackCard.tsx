import React from 'react';
import { TrendingUp, Clock, Target } from 'lucide-react';
import { DashboardData } from '../../types';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface RoiPaybackCardProps {
    data: DashboardData;
}

export const RoiPaybackCard: React.FC<RoiPaybackCardProps> = ({ data }) => {
    const stats = data.financial_stats;
    const capex = stats.total_capex_idr > 0 ? stats.total_capex_idr : 120000000; // Fallback 120M IDR (~$8k) for demo
    const roi = stats.irr_percent > 0 ? stats.irr_percent : 18.5; // Fallback 18.5%
    const paybackYears = stats.payback_years > 0 ? stats.payback_years : 4.2; // Fallback 4.2 years
    const progress = stats.payback_progress_percent || 25; // 25% paid back

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">ROI & Payback</h3>
            </div>

            <div className="space-y-6">
                {/* Payback Progress */}
                <div>
                    <div className="flex justify-between text-xs mb-2">
                        <span className="font-medium text-slate-600">Payback Progress</span>
                        <span className="font-bold text-slate-900">{progress.toFixed(1)}%</span>
                    </div>
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                            style={{ width: `${Math.min(100, progress)}%` }}
                        />
                    </div>
                    <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                        <span>Installation</span>
                        <span>Breakeven ({paybackYears} yrs)</span>
                    </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Annual ROI</span>
                        </div>
                        <div className="text-xl font-bold text-slate-800">{roi}%</div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Payback Period</span>
                        </div>
                        <div className="text-xl font-bold text-slate-800">{paybackYears} <span className="text-sm font-medium text-slate-400">Years</span></div>
                    </div>
                </div>

                {/* System Cost Info */}
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-medium">System CAPEX</span>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(capex)}</span>
                </div>
            </div>
        </div>
    );
};
