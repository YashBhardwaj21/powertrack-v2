import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { DashboardData } from '../../types';
import { PieChart } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface ValueBreakdownChartProps {
    data: DashboardData;
}

export const ValueBreakdownChart: React.FC<ValueBreakdownChartProps> = ({ data }) => {

    // -------------------------------------------------------
    // CLEAN, CORRECT CALCULATION (NO SCOPE BUGS)
    // -------------------------------------------------------
    const {
        selfConsumedValue,
        exportedValue,
        totalValue,
        totalGenKWh,
        totalExportKWh,
        exportRate
    } = useMemo(() => {

        const importRate = data.metadata.electricity_rate_idr || 1444.70;
        const exportRate = 0; // keep your assumption for now

        let totalGen = 0;
        let totalExport = 0;

        if (Array.isArray(data.hourly_historical)) {
            data.hourly_historical.forEach(h => {
                totalGen += Number(h.energy || 0);       // kWh produced
                totalExport += Number(h.avg_export || 0); // kWh exported
            });
        }

        // Never allow export > generation (safety clamp)
        const safeExport = Math.min(totalExport, totalGen);
        const selfConsumed = Math.max(0, totalGen - safeExport);

        const vSelf = selfConsumed * importRate;
        const vExport = safeExport * exportRate;

        return {
            selfConsumedValue: vSelf,
            exportedValue: vExport,
            totalValue: vSelf + vExport,
            totalGenKWh: totalGen,
            totalExportKWh: safeExport,
            exportRate
        };

    }, [data]);

    // -------------------------------------------------------
    // ECHARTS CONFIG (FIXED + CLEAR)
    // -------------------------------------------------------
    const option = {
        tooltip: {
            trigger: 'item',
            formatter: (params: any) => {
                return `<b>${params.name}</b><br/>
                        ${formatCurrency(params.value)} (${params.percent}%)`;
            }
        },
        legend: {
            bottom: '5%',
            left: 'center',
            icon: 'circle'
        },
        series: [
            {
                name: 'Value Breakdown',
                type: 'pie',
                radius: ['40%', '70%'],
                avoidLabelOverlap: false,
                itemStyle: {
                    borderRadius: 10,
                    borderColor: '#fff',
                    borderWidth: 2
                },
                label: { show: false },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold',
                        formatter: '{b}\n{d}%'
                    }
                },
                data: [
                    {
                        value: Math.round(selfConsumedValue),
                        name: 'Self-Consumed (Saved)',
                        itemStyle: { color: '#10b981' }
                    },
                    {
                        value: Math.round(exportedValue),
                        name: exportRate > 0
                            ? 'Exported (Feed-in Income)'
                            : 'Exported (No FiT)',
                        itemStyle: { color: '#3b82f6' }
                    }
                ]
            }
        ]
    };

    // -------------------------------------------------------
    // UI RENDER
    // -------------------------------------------------------
    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">

            <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-5 h-5 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                    Value Breakdown
                </h3>
            </div>

            <div className="flex-grow min-h-[250px] relative">
                <ReactECharts option={option} style={{ height: '300px', width: '100%' }} />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-center">

                <div className="p-3 bg-emerald-50 rounded-lg">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase">
                        Avoided Cost
                    </div>
                    <div className="text-lg font-bold text-emerald-700">
                        {formatCurrency(selfConsumedValue)}
                    </div>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-[10px] font-bold text-blue-600 uppercase">
                        Export Income
                    </div>
                    <div className="text-lg font-bold text-blue-700">
                        {formatCurrency(exportedValue)}
                    </div>
                </div>

            </div>
        </div>
    );
};
