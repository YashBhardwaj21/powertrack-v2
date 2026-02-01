import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { DashboardData } from '../../types';
import { PieChart } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface ValueBreakdownChartProps {
    data: DashboardData;
}

export const ValueBreakdownChart: React.FC<ValueBreakdownChartProps> = ({ data }) => {
    const { selfConsumedValue, exportedValue, totalValue } = useMemo(() => {
        // Rates
        const importRate = data.metadata.electricity_rate_idr || 1444.70;
        const exportRate = 0; // Assuming 0 for now as per "else zero" rule, can be parameterized later

        // Calculate totals from hourly history (most granular source for Self-Cons vs Export)
        // Self-Cons Energy = Generation - Export
        // We need to sum up (Generation * ImportRate) - (Export * ImportRate) + (Export * ExportRate)?
        // Wait, Self-Consumed Energy = (Gen - Export).
        // Value of Self-Consumed = Self-Consumed Energy * ImportRate (Avoided Cost).
        // Value of Export = Export * ExportRate.
        // Total Value = Self-Consumed Value + Export Value.

        let totalGen = 0;
        let totalExport = 0;

        if (data.hourly_historical) {
            data.hourly_historical.forEach(h => {
                totalGen += (Number(h.avg_power) || 0); // approx kWh per hour
                totalExport += (Number(h.avg_export) || 0); // approx kWh per hour
            });
        }

        // Safety: Export shouldn't exceed Gen in aggregated sense, but data might be noisy
        if (totalExport > totalGen) totalExport = totalGen;

        const selfConsumed = Math.max(0, totalGen - totalExport);

        const vSelf = selfConsumed * importRate;
        const vExport = totalExport * exportRate;

        return {
            selfConsumedValue: vSelf,
            exportedValue: vExport,
            totalValue: vSelf + vExport
        };
    }, [data]);

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
                label: {
                    show: false,
                    position: 'center'
                },
                emphasis: {
                    label: {
                        show: true,
                        fontSize: 14,
                        fontWeight: 'bold',
                        formatter: '{b}\n{d}%'
                    }
                },
                labelLine: {
                    show: false
                },
                data: [
                    { value: Math.round(selfConsumedValue), name: 'Self-Consumed (Saved)', itemStyle: { color: '#10b981' } }, // Emerald-500
                    { value: Math.round(exportedValue), name: 'Exported (Earned)', itemStyle: { color: '#3b82f6' } }       // Blue-500
                ]
            }
        ]
    };

    return (
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm h-full flex flex-col">
            <div className="flex items-center gap-2 mb-4">
                <PieChart className="w-5 h-5 text-slate-500" />
                <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">Value Breakdown</h3>
            </div>

            <div className="flex-grow min-h-[250px] relative">
                <ReactECharts option={option} style={{ height: '300px', width: '100%' }} />

                {/* Center Text Overlay if Library support is tricky, but Pie chart has logic. 
                   Adding summary text below */}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-4 text-center">
                <div className="p-3 bg-emerald-50 rounded-lg">
                    <div className="text-[10px] font-bold text-emerald-600 uppercase">Avoided Cost</div>
                    <div className="text-lg font-bold text-emerald-700">{formatCurrency(selfConsumedValue)}</div>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                    <div className="text-[10px] font-bold text-blue-600 uppercase">Export Income</div>
                    <div className="text-lg font-bold text-blue-700">{formatCurrency(exportedValue)}</div>
                </div>
            </div>
        </div>
    );
};
