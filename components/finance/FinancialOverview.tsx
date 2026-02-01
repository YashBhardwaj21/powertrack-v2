import React from 'react';
import { Coins, Wallet, LineChart } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';
import { DashboardData } from '../../types';

interface FinancialOverviewProps {
    data: DashboardData;
}

export const FinancialOverview: React.FC<FinancialOverviewProps> = ({ data }) => {
    const rate = data.metadata.electricity_rate_idr || 1444.70; // Default IDR rate if missing

    // 1. Calculate Today's Savings
    // Sum of daily_energy_kwh from all schools (current telemetry) * Rate
    // Note: Telemetry daily_energy_kwh is "Today's energy so far"
    const todayEnergy = data.current_data.reduce((sum, t) => sum + (Number(t.daily_energy_kwh) || 0), 0);
    const todaySavings = todayEnergy * rate;

    // 2. Calculate Month's Savings
    // Filter daily_historical for current month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    // Ensure daily_historical dates are parsed correctly
    const monthEnergy = data.daily_historical
        .filter(d => {
            const date = new Date(d.date);
            return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
        })
        .reduce((sum, d) => sum + d.total_energy_kwh, 0);

    // Add today's energy to month total if daily_historical doesn't include today yet? 
    // Usually daily_historical is up to yesterday or includes today if synthesized. 
    // Let's assume daily_historical is "closed days" + we add today? 
    // Or if daily_historical is updated in real-time. 
    // Safest: Use daily_historical sum. If it seems low, check if today is included.
    // For now, simple sum.
    const monthSavings = monthEnergy * rate;

    // 3. Lifetime Savings
    // Use backend stats or fallback to calculated
    const lifetimeSavings = data.financial_stats.total_savings_idr;

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Money Saved Today */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Coins className="w-16 h-16 text-emerald-500" />
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Money Saved Today</span>
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

            {/* Money Saved This Month */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <Wallet className="w-16 h-16 text-blue-500" />
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Saved This Month</span>
                    <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl font-bold text-blue-600 tracking-tight">
                            {formatCurrency(monthSavings)}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                        {new Date().toLocaleString('default', { month: 'long' })} {currentYear}
                    </p>
                </div>
            </div>

            {/* Lifetime Savings */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <LineChart className="w-16 h-16 text-violet-500" />
                </div>
                <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Lifetime Value</span>
                    <div className="flex items-baseline gap-1 mt-2">
                        <span className="text-2xl font-bold text-slate-800 tracking-tight">
                            {formatCurrency(lifetimeSavings)}
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">
                        Total ROI since installation
                    </p>
                </div>
            </div>
        </div>
    );
};
