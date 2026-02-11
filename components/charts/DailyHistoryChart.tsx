import React from 'react';
import ReactECharts from 'echarts-for-react';
import { formatEnergy } from '../../utils/formatters';
import { EmptyState } from '../ui/EmptyState';
import { BarChart3 } from 'lucide-react';
import * as echarts from 'echarts';
import { formatDateInSchoolTZ } from '../../utils/timezone';

interface DailyHistoryChartProps {
    data: { date: string; total_energy_kwh: number }[];
    onDateClick?: (date: string) => void;
    timezone?: string; // School's IANA timezone
}

export const DailyHistoryChart: React.FC<DailyHistoryChartProps> = ({ data, onDateClick, timezone = 'UTC' }) => {
    if (!data || data.length === 0 || data.every(d => d.total_energy_kwh === 0)) {
        return (
            <div className="h-[320px] flex items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <EmptyState
                    icon={BarChart3}
                    title="No Daily Data"
                    description="No daily energy production records found for this period."
                />
            </div>
        );
    }

    const option = {
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: any) => {
                const p = params[0];
                const date = formatDateInSchoolTZ(p.name, timezone);
                return `<div class="font-bold mb-1">${date}</div>
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
            type: 'category',
            data: data.map(d => d.date),
            axisLabel: {
                color: '#64748b',
                formatter: (value: string) => {
                    const d = new Date(value);
                    return d.toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        timeZone: timezone
                    });
                }
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
                name: 'Daily Production',
                type: 'bar',
                data: data.map(d => ({
                    value: d.total_energy_kwh,
                    itemStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: "#0ea5e9" }, { offset: 1, color: "#38bdf8" }])
                    }
                })),
                barWidth: '50%',
                itemStyle: { borderRadius: [4, 4, 0, 0] },
                animationDelay: (idx: number) => idx * 30, // Faster stagger for more bars
                markLine: {
                    data: [{ type: 'average', name: 'Avg' }],
                    lineStyle: { color: '#94a3b8', type: 'dashed' },
                    label: { position: 'end', color: '#64748b' }
                }
            }
        ]
    };

    const onChartClick = (params: any) => {
        if (onDateClick && params.componentType === 'series' && params.name) {
            onDateClick(params.name);
        }
    };

    const onEvents = {
        'click': onChartClick
    };

    return <ReactECharts option={option} style={{ height: '320px', width: '100%' }} onEvents={onEvents} />;
};
