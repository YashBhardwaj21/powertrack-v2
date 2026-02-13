import React from 'react';
import { Leaf } from 'lucide-react';
import { DashboardData } from '../../types';

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
                {/* Scientific footnote (important for credibility) */}
                <div className="text-[10px] text-slate-400 text-center mt-2 leading-tight">
                    Based on grid carbon intensity.
                </div>
            </div>
        </div>
    );
};
