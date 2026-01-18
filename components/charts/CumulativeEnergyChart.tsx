import React from 'react';
import ReactECharts from 'echarts-for-react';
import { formatEnergy } from '../../utils/formatters';
import { EmptyState } from '../ui/EmptyState';
import { TrendingUp } from 'lucide-react';
import * as echarts from 'echarts';

interface CumulativeEnergyChartProps {
    data: { label: string; value: number | null }[];
}

export const CumulativeEnergyChart: React.FC<CumulativeEnergyChartProps> = ({ data }) => {
    if (!data || data.length === 0 || data.every(d => d.value === 0)) {
        return (
            <div className="h-[300px] flex items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <EmptyState
                    icon={TrendingUp}
                    title="No Historical Data"
                    description="No cumulative energy records found for this period."
                />
            </div>
        );
    }

    const sortedData = data; // Assuming backend already sorts by hour as implemented

    const option = {
        tooltip: {
            trigger: 'axis',
            formatter: (params: any) => {
                const p = params[0];
                return `<div class="font-bold mb-1">${p.name}</div>
                        <div class="text-sm">Power: ${p.value !== null ? p.value.toFixed(1) + ' kW' : '—'}</div>`;
            }
        },
        grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
        },
        xAxis: {
            type: 'category',
            boundaryGap: false,
            data: sortedData.map(d => d.label),
            axisLabel: { color: '#64748b' },
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
                name: 'Cumulative Energy',
                type: 'line',
                smooth: true,
                symbol: 'none',
                areaStyle: {
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "rgba(59, 130, 246, 0.5)" }, { offset: 1, color: "rgba(59, 130, 246, 0.0)" }])
                },
                lineStyle: {
                    color: '#3b82f6',
                    width: 3
                },
                data: sortedData.map(d => d.value)
            }
        ]
    };

    return <ReactECharts option={option} style={{ height: '300px', width: '100%' }} />;
};
