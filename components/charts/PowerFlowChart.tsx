import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

interface PowerFlowChartProps {
    data: Array<{
        hour: string;
        avg_power: number; // Solar
        avg_load: number; // Load
        avg_import: number; // Grid Import
        avg_export: number; // Grid Export
    }>;
}

export const PowerFlowChart: React.FC<PowerFlowChartProps> = ({ data }) => {
    const chartOption = useMemo(() => {
        if (!data || data.length === 0) return null;

        // Transform data for plotting
        const times = data.map(d => new Date(d.hour).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        const solar = data.map(d => d.avg_power || 0);
        const load = data.map(d => d.avg_load || 0);

        // Calculate Net Grid Flow (Import - Export) or visualize separately?
        // User requested: "Grid Import/Export ... Green for export, Red for import"
        // Let's plot "Grid Interaction" where +ve = Import (Dependency), -ve = Export (Giving back)
        // OR plot separate lines.
        // User Request: "Lines to Show: Solar, Load, Grid Import/Export dependency"
        // Let's use a single "Grid" line: Import (positive), Export (negative)?
        // Or better: Two lines if possible, or stacked?
        // Let's go with "Grid Net" line for simplicity in the "Multi-line time series" context,
        // but arguably showing Import vs Export as separate lines is clearer.
        // Let's follow the "3 Lines" instruction: Solar, Load, Grid.
        // Grid = Import - Export.
        const grid = data.map(d => (d.avg_import || 0) - (d.avg_export || 0));

        return {
            tooltip: {
                trigger: 'axis',
                axisPointer: { type: 'cross' },
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                borderColor: '#e2e8f0',
                textStyle: { color: '#1e293b' },
                formatter: (params: any[]) => {
                    let date = params[0].name;
                    let tooltip = `<div class="font-bold mb-2">${date}</div>`;

                    params.forEach(p => {
                        let val = Number(p.value).toFixed(2);
                        let color = p.color;
                        if (p.seriesName === 'Solar Generation') {
                            tooltip += `<div style="color:${color}">☀️ Solar: ${val} kW</div>`;
                        } else if (p.seriesName === 'Load Consumption') {
                            tooltip += `<div style="color:${color}">🏠 Load: ${val} kW</div>`;
                        } else if (p.seriesName === 'Grid Interaction') {
                            const numVal = Number(p.value);
                            const label = numVal > 0 ? `📥 Import: ${val} kW` : `📤 Export: ${Math.abs(numVal).toFixed(2)} kW`;
                            tooltip += `<div style="color:${color}">⚡ Grid: ${label}</div>`;
                        }
                    });
                    return tooltip;
                }
            },
            legend: {
                data: ['Solar Generation', 'Load Consumption', 'Grid Interaction'],
                bottom: 0,
                icon: 'circle'
            },
            grid: {
                left: '2%',
                right: '2%',
                bottom: '10%',
                top: '5%',
                containLabel: true
            },
            xAxis: {
                type: 'category',
                boundaryGap: false,
                data: times,
                axisLine: { show: false },
                axisTick: { show: false },
                axisLabel: { color: '#94a3b8' }
            },
            yAxis: {
                type: 'value',
                axisLabel: { color: '#94a3b8', formatter: '{value} kW' },
                splitLine: { lineStyle: { type: 'dashed', color: '#f1f5f9' } }
            },
            series: [
                {
                    name: 'Solar Generation',
                    type: 'line',
                    smooth: true,
                    symbol: 'none',
                    lineStyle: { width: 0 },
                    areaStyle: {
                        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                            { offset: 0, color: 'rgba(34, 197, 94, 0.4)' },
                            { offset: 1, color: 'rgba(34, 197, 94, 0.05)' }
                        ])
                    },
                    data: solar,
                    z: 1 // Layer at bottom
                },
                {
                    name: 'Load Consumption',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { width: 2, color: '#3b82f6' }, // Blue
                    data: load,
                    z: 3
                },
                {
                    name: 'Grid Interaction',
                    type: 'line',
                    smooth: true,
                    showSymbol: false,
                    lineStyle: { width: 2, color: '#64748b', type: 'dashed' }, // Grey dashed
                    data: grid,
                    z: 2
                }
            ]
        };
    }, [data]);

    if (!data || data.length === 0) {
        return (
            <div className="h-full w-full flex items-center justify-center text-slate-400 bg-slate-50/50 rounded-lg">
                Waiting for sufficient telemetry history...
            </div>
        );
    }

    return <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />;
};
