import React from 'react';
import { DashboardData } from '../types';
import { Zap, DollarSign, Leaf, Activity } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { TRANSLATIONS } from '../constants';
import { formatPower, formatEnergy, formatCurrency, formatCO2 } from '../utils/formatters';

interface StatsOverviewProps {
    data: DashboardData;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ data }) => {
    const { locale } = useDashboard();
    const t = TRANSLATIONS[locale];

    // Safe access to data properties
    const currentData = data?.current_data || [];
    const leaderboardStats = data?.leaderboard_stats || [];
    const metadata = data?.metadata || { electricity_rate_idr: 0, carbon_intensity_kg_per_kwh: 0 };

    // Double safety for null vs undefined
    const safeMetadata = metadata || { electricity_rate_idr: 0, carbon_intensity_kg_per_kwh: 0 };

    const totalPower = currentData.reduce((sum, d) => sum + (Number(d.ac_power_kw) || 0), 0);
    // Use leaderboard_stats (Lifetime) instead of current_data (Daily)
    const totalEnergy = leaderboardStats.reduce((sum, s) => sum + (Number(s.total_energy_kwh) || 0), 0);
    const totalSavings = totalEnergy * (safeMetadata.electricity_rate_idr || 0);
    const totalCO2 = totalEnergy * (safeMetadata.carbon_intensity_kg_per_kwh || 0);

    // Determine global status for the row
    const hasData = (currentData.length > 0 && totalPower > 0) || leaderboardStats.length > 0;

    const cards = [
        {
            label: t.total_power,
            value: formatPower(totalPower),
            icon: Zap,
            color: "text-amber-600",
            bg: "bg-amber-50",
            borderColor: "border-amber-100"
        },
        {
            label: 'Lifetime Energy', // Updated to reflect lifetime stats
            value: formatEnergy(totalEnergy),
            icon: Activity,
            color: "text-blue-600",
            bg: "bg-blue-50",
            borderColor: "border-blue-100"
        },
        {
            label: t.savings,
            value: formatCurrency(totalSavings),
            icon: DollarSign,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            borderColor: "border-emerald-100"
        },
        {
            label: t.co2,
            value: formatCO2(totalCO2),
            icon: Leaf,
            color: "text-teal-600",
            bg: "bg-teal-50",
            borderColor: "border-teal-100"
        }
    ];

    if (!hasData) {
        return (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <p className="text-sm font-medium text-slate-600">Waiting for real-time telemetry from connected schools...</p>
                </div>
                <div className="text-xs text-slate-400 font-mono">System Standby</div>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {cards.map((card, idx) => (
                <div key={idx} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm flex items-center gap-4 hover:border-slate-300 transition-colors">
                    <div className={`p-2.5 rounded-lg ${card.bg} ${card.color} border ${card.borderColor}`}>
                        <card.icon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-0.5">{card.label}</p>
                        <h3 className="text-2xl font-bold text-slate-900 leading-none">{card.value}</h3>
                    </div>
                </div>
            ))}
        </div>
    );
};
