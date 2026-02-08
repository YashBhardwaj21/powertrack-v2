import React from 'react';
import { Leaf, Trees, Car } from 'lucide-react';
import { DashboardData } from '../../types';
import { formatCO2 } from '../../utils/formatters';

interface EnvironmentalImpactCardProps {
    data: DashboardData;
}

export const EnvironmentalImpactCard: React.FC<EnvironmentalImpactCardProps> = ({ data }) => {

    // ===========================
    // SCIENTIFIC BASELINE
    // ===========================

    const co2AvoidedKg = Number(data.financial_stats?.co2_avoided_kg || 0);

    // Convert to tonnes (clearer for humans)
    const co2AvoidedTonnes = co2AvoidedKg / 1000;

    // --- Trees logic (more honest framing) ---
    // Typical absorption: ~21 kg CO2 per tree per year (global average)
    const treesEquivalent = Math.floor(co2AvoidedKg / 21);

    // --- Car logic (FIXED + FACT-BASED) ---
    // Average passenger car emissions ≈ 0.12 kg CO2 per km (well-cited global average)
    const KG_PER_KM_CAR = 0.12;

    const carKmAvoided = Math.floor(co2AvoidedKg / KG_PER_KM_CAR);

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">

            <div className="flex items-center gap-2 mb-6">
                <Leaf className="w-5 h-5 text-emerald-500" />
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Environmental Impact
                </h3>
            </div>

            {/* BIG HEADLINE METRIC */}
            <div className="flex-grow flex flex-col justify-center items-center py-4">
                <div className="text-4xl font-extrabold text-emerald-600 mb-1">
                    {co2AvoidedTonnes.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2
                    })} t
                </div>
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">
                    Tonnes of CO₂ Avoided (Lifetime)
                </div>
            </div>

            <div className="space-y-4 mt-4">

                {/* Trees Equivalent */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-full text-green-600">
                            <Trees className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 font-medium">
                                Trees Equivalent (1 year absorption)
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                                {treesEquivalent.toLocaleString()} mature trees
                            </span>
                        </div>
                    </div>
                </div>

                {/* Car Travel Equivalent (FIXED) */}
                <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-orange-100 rounded-full text-orange-600">
                            <Car className="w-4 h-4" />
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 font-medium">
                                Car Travel Equivalent
                            </span>
                            <span className="text-sm font-bold text-slate-900">
                                {carKmAvoided.toLocaleString()} km avoided
                            </span>
                        </div>
                    </div>
                </div>

                {/* Scientific footnote (important for credibility) */}
                <div className="text-[10px] text-slate-400 text-center mt-2 leading-tight">
                    Based on grid carbon intensity and an average car emission of 0.12 kg CO₂/km.
                </div>

            </div>
        </div>
    );
};
