import React from 'react';
import ReactECharts from 'echarts-for-react';
import { formatEnergy } from '../../utils/formatters';
import { EmptyState } from '../ui/EmptyState';
import { BarChart3 } from 'lucide-react';
import * as echarts from 'echarts'; // For gradient

interface DailyEnergyChartProps {
    data: { name: string; value: number; schoolId: string }[];
}

export const DailyEnergyChart: React.FC<DailyEnergyChartProps> = ({ data }) => {
    if (!data || data.length === 0 || data.every(d => d.value === 0)) {
        return (
            <div className="h-[400px] flex items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <EmptyState
                    icon={BarChart3}
                    title="No Energy Data Available"
                    description="There is no energy production data to display for the selected period."
                />
            </div>
        );
    }

    // Sort logic should happen in parent or here
    const sortedData = [...data].sort((a, b) => a.value - b.value);

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: any) => {
                const p = params[0];
                return `<div class="font-bold mb-1">${p.name}</div>
                        <div class="text-sm">Energy: ${formatEnergy(p.value)}</div>`;
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'value',
            splitLine: {
                lineStyle: { type: 'dashed', color: '#f1f5f9' }
            },
            axisLabel: { color: '#64748b' }
        },
        yAxis: {
            type: 'category',
            data: sortedData.map(d => d.name),
            axisLabel: { color: '#64748b', width: 100, overflow: 'truncate' },
            axisLine: { show: false },
            axisTick: { show: false }
        },
        series: [
            {
                name: 'Daily Energy',
                type: 'bar',
                data: sortedData.map(d => ({
                    value: d.value,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 1, 0, [{ offset: 0, color: "#3b82f6" }, { offset: 1, color: "#2563eb" }])
                    }
                })),
                barWidth: '60%',
                itemStyle: { borderRadius: [0, 4, 4, 0] }
            }
        ]
    };

    return <ReactECharts option={option} style={{ height: '400px', width: '100%' }} />;
};
