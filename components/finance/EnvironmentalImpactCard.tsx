import React from 'react';
import { Leaf, Trees, Car, Factory } from 'lucide-react';
import { DashboardData } from '../../types';
import { formatCO2 } from '../../utils/formatters';

interface EnvironmentalImpactCardProps {
    data: DashboardData;
}

export const EnvironmentalImpactCard: React.FC<EnvironmentalImpactCardProps> = ({ data }) => {
    // Use backend-provided values (which are now consistent with DB)
    const co2AvoidedLifetime = data.financial_stats?.co2_avoided_kg || 0;
    const treesPlanted = Math.floor(data.financial_stats?.trees_planted || 0);
    const carKm = Math.floor(data.financial_stats?.car_km_avoided || 0);

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
