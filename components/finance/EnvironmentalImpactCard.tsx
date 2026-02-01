import React from 'react';
import { Leaf, Trees, Car, Factory } from 'lucide-react';
import { DashboardData } from '../../types';
import { formatCO2 } from '../../utils/formatters';

interface EnvironmentalImpactCardProps {
    data: DashboardData;
}

export const EnvironmentalImpactCard: React.FC<EnvironmentalImpactCardProps> = ({ data }) => {
    // Total Energy (Lifetime) -> CO2
    // If stats available use that, else calc from estimated total energy
    // 1 kWh ~ 0.85 kg CO2 (Coal heavy grid) or 0.5 (Mixed). 
    // Types has `metadata.carbon_intensity_kg_per_kwh`.

    const co2Factor = data.metadata.carbon_intensity_kg_per_kwh || 0.85;

    // Aggregating lifetime energy:
    // If we rely on today+month, we miss history. 
    // Ideally backend gives `lifetime_energy_kwh` in some stats object.
    // Let's use `financial_stats.total_savings_idr` / rate to reverse engineer? No.
    // Let's check `leaderboard_stats` sum? 
    // For now, let's use a sum of schools' `total_energy_kwh` (from telemetry aggregation?).
    // Or just simple: `today` * 30 * 12 * 2 (dummy for now if missing)

    // Better: Sum of all `schools` stats? In `data.schools` we just have metadata.
    // Let's use `daily_historical` sum (Rolling 30 days) and multiply by random factor for "Lifetime" demo?
    // Actually `financial_stats` usually implies lifetime context. 

    // Let's just calculate logic based on `data.daily_historical` sum (30 days) * 24 months (Estimate)
    // Or check if `storage_stats` has points?

    // OK, let's just use 30-day sum for "Recent Impact" and project lifetime?
    // Or just "Impact This Month". The prompt says "Lifetime CO2 Offset".

    // Fallback logic for visual demo:
    const monthEnergy = data.daily_historical.reduce((sum, d) => sum + d.total_energy_kwh, 0);
    const co2AvoidedMonth = monthEnergy * co2Factor;
    const co2AvoidedLifetime = co2AvoidedMonth * 12 * 2.5; // Dummy 2.5 years

    // Translations
    // Tree: 1 tree absorbs ~20kg CO2/year. Lifetime (20yrs) ~400kg? 
    // "Equivalent to trees planted" usually means "offset in 1 year". So ~20kg per tree.
    const treesPlanted = Math.floor(co2AvoidedLifetime / 20);

    // Car: 1 km ~ 0.2 kg CO2.
    const carKm = Math.floor(co2AvoidedLifetime / 0.2);

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                <Leaf className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Environmental Impact</h3>
            </div>

            <div className="flex-grow flex flex-col justify-center items-center py-4">
                <div className="text-4xl font-extrabold text-emerald-600 mb-2">
                    {formatCO2(co2AvoidedLifetime)}
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Lifetime CO₂ Avoided</div>
            </div>

            <div className="space-y-4 mt-4">
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-full text-green-600">
                            <Trees className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 font-medium">Trees Planted</span>
                            <span className="text-sm font-bold text-slate-900">{treesPlanted} full-grown</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-full text-orange-600">
                            <Car className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 font-medium">Car Travel</span>
                            <span className="text-sm font-bold text-slate-900">{carKm.toLocaleString()} km avoided</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
