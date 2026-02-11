import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { formatEnergy } from '../../utils/formatters';
import { EmptyState } from '../ui/EmptyState';
import { BarChart3 } from 'lucide-react';

interface DailyEnergyChartProps {
    // Data shape: { hour: string (ISO), avg_power: number, energy: number ... }
    data: Array<{ hour: string; avg_power: number; energy: number }>;
    timezone?: string; // School's IANA timezone
}

export const DailyEnergyChart: React.FC<DailyEnergyChartProps> = ({ data, timezone = 'UTC' }) => {
    // 1. Data Processing: Smart Date Selection
    const { chartCategories, chartValues, displayedDate } = useMemo(() => {
        // Initialize 24-hour buckets
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const categories = hours.map(h => `${h.toString().padStart(2, '0')}:00`);

        if (!data || data.length === 0) {
            return {
                chartCategories: categories,
                chartValues: new Array(24).fill(0),
                displayedDate: new Date()
            };
        }

        // Group data by Date String (YYYY-MM-DD local)
        const dataByDate = new Map<string, typeof data>();
        data.forEach(p => {
            const pDate = new Date(p.hour);
            const dateKey = pDate.toLocaleDateString();
            if (!dataByDate.has(dateKey)) dataByDate.set(dateKey, []);
            dataByDate.get(dateKey)?.push(p);
        });

        // Determine target date
        const now = new Date();
        const todayKey = now.toLocaleDateString();
        const yesterday = new Date(now);
        yesterday.setDate(now.getDate() - 1);
        const yesterdayKey = yesterday.toLocaleDateString();

        const targetKey = todayKey;
        const targetData = dataByDate.get(todayKey) || [];
        // Always show today, even if empty (midnight scenario)

        const values = new Array(24).fill(0);
        const targetDateObj = new Date(targetData.length > 0 ? targetData[0].hour : now);

        targetData.forEach(p => {
            const pDate = new Date(p.hour);
            const hour = pDate.getHours();
            if (hour >= 0 && hour < 24) {
                values[hour] += Number(p.energy) || 0;
            }
        });

        return { chartCategories: categories, chartValues: values, displayedDate: targetDateObj };
    }, [data]);

    // Check if chart is completely empty (all zeros) but we return full grid anyway
    const isEmpty = chartValues.every(v => v === 0);

    // If empty, we still show the grid (00:00 to 23:00) so the user knows it's "Today"
    // But if we want an explicit empty state when NO data has arrived yet (e.g. 1 AM):
    // Actually, showing an empty grid is better feedback than "Waiting for Data" text,
    // because it confirms "Yes, we are monitoring today, but 0 energy so far".
    // However, if the array is totally empty/null, that's different.
    // The buckets ensure we always have 24 bars.

    // We only show EmptyState if data prop was null/empty entirely? 
    // No, strictly adhering to "Today" view means empty grid is valid at midnight.
    // Check if chart is completely empty (all zeros) but we return full grid anyway

    if (!data || data.length === 0) {
        // Fallback or empty state if ABSOLUTELY no data fetched
        // However, we want to show empty grid if fetch succeeded but result was empty?
        // Let's stick to showing the component if data array exists (even if empty) 
        // to show "00:00 ... 23:00" empty chart.
        // But the previous condition was strict on null data.
        return (
            <div className="h-[320px] flex items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                <EmptyState
                    icon={BarChart3}
                    title="Waiting for Production"
                    description="Energy generated today will appear here as hourly bars."
                />
            </div>
        );
    }

    const option = {
        grid: {
            top: 30,
            right: 20,
            bottom: 50, // Increased for dataZoom slider
            left: 20,
            containLabel: true
        },
        tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' },
            formatter: (params: any) => {
                const p = params[0];
                return `<div class="font-bold mb-1">${p.name}</div>
                        <div class="text-sm">Energy: <span class="font-bold text-blue-600">${formatEnergy(p.value)}</span></div>`;
            }
        },
        xAxis: {
            type: 'category',
            data: chartCategories,
            axisLabel: {
                color: '#94a3b8',
                interval: 3, // 00, 04, 08, 12, 16, 20
                hideOverlap: true
            },
            axisLine: { show: false },
            axisTick: { show: false },
        },
        yAxis: {
            type: 'value',
            position: 'right',
            splitLine: {
                lineStyle: {
                    type: 'dashed',
                    color: '#f1f5f9'
                }
            },
            axisLabel: {
                color: '#94a3b8',
                formatter: (val: number) => `${val.toFixed(1)} kWh`
            }
        },
        series: [
            {
                name: 'Hourly Energy',
                type: 'bar',
                data: chartValues,
                barWidth: '60%',
                barMaxWidth: 40,
                itemStyle: {
                    borderRadius: [4, 4, 0, 0],
                    color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                        { offset: 0, color: '#2563eb' }, // Blue-600
                        { offset: 1, color: '#60a5fa' }  // Blue-400
                    ])
                },
                showBackground: true,
                backgroundStyle: {
                    color: 'rgba(241, 245, 249, 0.4)',
                    borderRadius: [4, 4, 0, 0]
                },
                animationDelay: (idx: number) => idx * 50, // Staggered animation
                markPoint: {
                    data: [
                        { type: 'max', name: 'Peak' }
                    ],
                    label: {
                        color: '#fff',
                        backgroundColor: '#1e293b',
                        borderRadius: 4,
                        padding: [4, 8],
                        formatter: (params: any) => {
                            return params.value.toFixed(2);
                        }
                    }
                }
            }
        ],
        dataZoom: [
            {
                type: 'slider',
                show: true,
                xAxisIndex: [0],
                start: 0,
                end: 100,
                bottom: 0,
                height: 20
            },
            {
                type: 'inside',
                xAxisIndex: [0],
                start: 0,
                end: 100
            }
        ]
    };

    return <ReactECharts option={option} style={{ height: '320px', width: '100%' }} />;
};
