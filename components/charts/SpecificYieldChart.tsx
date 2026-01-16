import React from 'react';
import ReactECharts from 'echarts-for-react';
import { EmptyState } from '../ui/EmptyState';
import { BarChart3 } from 'lucide-react';
import * as echarts from 'echarts';

interface SpecificYieldChartProps {
    data: { name: string; value: number }[];
}

export const SpecificYieldChart: React.FC<SpecificYieldChartProps> = ({ data }) => {
    if (!data || data.length === 0 || data.every(d => d.value === 0)) {
        return (
            <div className="h-[400px] flex items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <EmptyState
                    icon={BarChart3}
                    title="No Performance Data"
                    description="Insufficient data to calculate specific yield metrics."
                />
            </div>
        );
    }

    // Sort by value descending
    const sortedData = [...data].sort((a, b) => b.value - a.value).slice(0, 10); // Top 10

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: any) => {
                const p = params[0];
                return `<div class="font-bold mb-1">${p.name}</div>
                        <div class="text-sm">Specific Yield: ${p.value} kWh/kWp</div>`;
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '15%', // More space for angled labels
            containLabel: true
        },
        xAxis: {
            type: 'category',
            data: sortedData.map(d => d.name),
            axisLabel: {
                color: '#64748b',
                rotate: 45,
                interval: 0
            },
            axisLine: { show: false },
            axisTick: { show: false }
        },
        yAxis: {
            type: 'value',
            splitLine: {
                lineStyle: { type: 'dashed', color: '#f1f5f9' }
            },
            axisLabel: { color: '#64748b' }
        },
        series: [
            {
                name: 'Specific Yield',
                type: 'bar',
                data: sortedData.map(d => ({
                    value: d.value,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#8b5cf6" }, { offset: 1, color: "#7c3aed" }])
                    }
                })),
                barWidth: '50%',
                itemStyle: { borderRadius: [4, 4, 0, 0] }
            }
        ]
    };

    return <ReactECharts option={option} style={{ height: '400px', width: '100%' }} />;
};
