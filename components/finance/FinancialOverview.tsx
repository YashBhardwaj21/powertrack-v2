import React from 'react';
import { Coins, Wallet, LineChart } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { DashboardData } from '../../types';

interface FinancialOverviewProps {
    data: DashboardData;
}

const FinancialOverviewComponent: React.FC<FinancialOverviewProps> = ({ data }) => {
    const rate = data.metadata.electricity_rate_idr || 1444.70;

    const todaySavings = data.financial_stats?.today_savings_idr || 0;
    const monthSavings = data.financial_stats?.month_savings_idr || 0;
    const lifetimeSavings = data.financial_stats?.total_savings_idr || 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">

            {/* ---------- TODAY ---------- */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Coins className="w-16 h-16 text-emerald-500" />
                </div>

                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Savings Today
                    </span>

                    <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl font-bold text-emerald-600 tracking-tight">
                            {formatCurrency(todaySavings)}
                        </span>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-1">
                        Based on {formatCurrency(rate)}/kWh tariff
                    </p>
                </div>
            </div>

            {/* ---------- THIS MONTH ---------- */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Wallet className="w-16 h-16 text-blue-500" />
                </div>

                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Savings This Month
                    </span>

                    <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl font-bold text-blue-600 tracking-tight">
                            {formatCurrency(monthSavings)}
                        </span>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-1">
                        {new Date().toLocaleString('default', { month: 'long' })}
                    </p>
                </div>
            </div>

            {/* ---------- LIFETIME ---------- */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <LineChart className="w-16 h-16 text-violet-500" />
                </div>

                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Lifetime Avoided Electricity Cost
                    </span>

                    <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl font-bold text-slate-800 tracking-tight">
                            {formatCurrency(lifetimeSavings)}
                        </span>
                    </div>

                    <p className="text-[10px] text-slate-400 mt-1">
                        Since installation
                    </p>
                </div>
            </div>
        </div>
    );
};

// 🔥 IMPORTANT FIX — explicit named export
export const FinancialOverview = FinancialOverviewComponent;
