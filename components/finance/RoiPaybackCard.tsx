import React from 'react';
import { TrendingUp, Clock, Target, AlertCircle } from 'lucide-react';
import { DashboardData } from '../../types';
import { formatCurrency, formatPercentage } from '../../utils/formatters';

interface RoiPaybackCardProps {
    data: DashboardData;
}

export const RoiPaybackCard: React.FC<RoiPaybackCardProps> = ({ data }) => {
    const stats = data.financial_stats;

    const hasValidFinance =
        stats &&
        stats.total_capex_idr > 0 &&
        stats.payback_years > 0 &&
        stats.irr_percent > 0;

    const capex = stats.total_capex_idr || 0;
    const irr = stats.irr_percent || 0;
    const paybackYears = stats.payback_years || 0;

    // Safe bounded progress
    const progress = Math.min(
        100,
        Math.max(0, stats.payback_progress_percent || 0)
    );

    if (!hasValidFinance) {
        return (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col justify-center items-center text-center gap-3">
                <AlertCircle className="w-6 h-6 text-amber-500" />
                <h3 className="text-sm font-bold text-slate-700 uppercase">
                    ROI & Payback
                </h3>
                <p className="text-xs text-slate-500 max-w-xs">
                    Insufficient financial data to compute ROI and payback.
                    Ensure at least 30 days of telemetry.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
            <div className="flex items-center gap-2 mb-6">
                <Target className="w-5 h-5 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                    ROI & Payback
                </h3>
            </div>

            <div className="space-y-6">

                {/* -------- Payback Progress -------- */}
                <div>
                    <div className="flex justify-between text-xs mb-2">
                        <span className="font-medium text-slate-600">
                            Payback Progress
                        </span>
                        <span className="font-bold text-slate-900">
                            {progress.toFixed(1)}%
                        </span>
                    </div>

                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                            style={{ width: `${progress}%` }}
                        />
                    </div>

                    <div className="flex justify-between mt-2 text-[10px] text-slate-400">
                        <span>Installation</span>
                        <span>Breakeven ≈ {paybackYears.toFixed(1)} yrs</span>
                    </div>
                </div>

                {/* -------- Metrics Grid -------- */}
                <div className="grid grid-cols-2 gap-4">

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp className="w-4 h-4 text-emerald-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                                IRR (Lifetime Return)
                            </span>
                        </div>
                        <div className="text-xl font-bold text-slate-800">
                            {formatPercentage(irr)}
                        </div>
                    </div>

                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-2 mb-1">
                            <Clock className="w-4 h-4 text-blue-500" />
                            <span className="text-[10px] font-bold text-slate-500 uppercase">
                                Payback Period
                            </span>
                        </div>
                        <div className="text-xl font-bold text-slate-800">
                            {paybackYears.toFixed(1)}
                            <span className="text-sm font-medium text-slate-400 ml-1">
                                years
                            </span>
                        </div>
                    </div>

                </div>

                {/* -------- CAPEX -------- */}
                <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
                    <span className="text-xs text-slate-500 font-medium">
                        System CAPEX (Installed)
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                        {formatCurrency(capex)}
                    </span>
                </div>

                <p className="text-[10px] text-slate-400">
                    Includes panels, inverter, mounting, wiring, and data logger.
                </p>

            </div>
        </div>
    );
};
