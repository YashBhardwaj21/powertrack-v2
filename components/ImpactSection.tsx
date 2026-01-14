import React from 'react';
import { DashboardData } from '../types';
import { Trees, Car, Home, Recycle } from 'lucide-react';

export const ImpactSection: React.FC<{ data: DashboardData }> = ({ data }) => {
    const totalEnergy = data.current_data.reduce((sum, d) => sum + d.total_energy_kwh, 0); // Using lifetime energy for massive impact stats
    const totalCO2 = totalEnergy * data.metadata.carbon_intensity_kg_per_kwh;
    
    // Impact calculations (approximate factors)
    const treesPlanted = Math.round(totalCO2 / 20); // 20kg CO2 per tree/year
    const carKm = Math.round(totalCO2 / 0.12); // 0.12kg CO2 per km
    const homesPowered = (totalEnergy / 3000).toFixed(1); // 3000 kWh per home/year (rough avg)

    const stats = [
        { icon: Trees, value: treesPlanted.toLocaleString(), label: "Trees Planted Equivalent", color: "text-emerald-300" },
        { icon: Car, value: `${(carKm / 1000).toFixed(1)}k`, label: "Km of Car Travel Offset", color: "text-blue-300" },
        { icon: Home, value: homesPowered, label: "Homes Powered for 1 Year", color: "text-yellow-300" },
        { icon: Recycle, value: `${(totalCO2 / 1000).toFixed(1)}`, label: "Tons of CO₂ Eliminated", color: "text-purple-300" }
    ];

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-xl shadow-lg p-8 text-white mb-8">
            <h2 className="text-2xl font-bold mb-8 text-center border-b border-white/10 pb-4">
                Cumulative Environmental Impact
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                {stats.map((stat, idx) => (
                    <div key={idx} className="text-center group">
                        <div className="bg-white/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-white/20 transition-all duration-300 transform group-hover:scale-110">
                            <stat.icon className={`w-8 h-8 ${stat.color}`} />
                        </div>
                        <div className="text-3xl font-bold mb-2 tracking-tight">{stat.value}</div>
                        <div className="text-blue-200 text-sm font-medium uppercase tracking-wide">{stat.label}</div>
                    </div>
                ))}
            </div>
        </div>
    );
};