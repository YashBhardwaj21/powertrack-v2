
import React from 'react';
import { DashboardData } from '../types';
import { Zap, DollarSign, Leaf, Activity } from 'lucide-react';
import { useDashboard } from '../context/DashboardContext';
import { TRANSLATIONS } from '../constants';

interface StatsOverviewProps {
    data: DashboardData;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ data }) => {
    const { locale } = useDashboard();
    const t = TRANSLATIONS[locale];

    const totalPower = data.current_data.reduce((sum, d) => sum + d.ac_power_kw, 0);
    const totalEnergy = data.current_data.reduce((sum, d) => sum + d.daily_energy_kwh, 0);
    const totalSavings = totalEnergy * data.metadata.electricity_rate_idr;
    const totalCO2 = totalEnergy * data.metadata.carbon_intensity_kg_per_kwh;

    const cards = [
        {
            label: t.total_power,
            value: `${totalPower.toFixed(1)} kW`,
            icon: Zap,
            color: "text-yellow-500",
            bg: "bg-yellow-50",
            border: "border-yellow-200"
        },
        {
            label: t.daily_energy,
            value: `${totalEnergy.toFixed(1)} kWh`,
            icon: Activity,
            color: "text-blue-500",
            bg: "bg-blue-50",
            border: "border-blue-200"
        },
        {
            label: t.savings,
            value: `Rp ${(totalSavings / 1000).toFixed(0)}k`,
            icon: DollarSign,
            color: "text-green-600",
            bg: "bg-green-50",
            border: "border-green-200"
        },
        {
            label: t.co2,
            value: `${totalCO2.toFixed(1)} kg`,
            icon: Leaf,
            color: "text-emerald-500",
            bg: "bg-emerald-50",
            border: "border-emerald-200"
        }
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {cards.map((card, idx) => (
                <div key={idx} className={`bg-white rounded-xl shadow-sm p-6 border-l-4 ${card.border} hover:shadow-md transition-shadow`}>
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-slate-500 text-sm font-medium mb-1">{card.label}</p>
                            <h3 className="text-2xl font-bold text-slate-800">{card.value}</h3>
                        </div>
                        <div className={`p-3 rounded-full ${card.bg}`}>
                            <card.icon className={`w-6 h-6 ${card.color}`} />
                        </div>
                    </div>
                </div>
            ))}
        </div>
    );
};
