
import React from 'react';
import { ModelMetrics } from '../types';
import { BrainCircuit, LineChart, Target, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

interface ModelHealthPanelProps {
    metrics: ModelMetrics;
}

export const ModelHealthPanel: React.FC<ModelHealthPanelProps> = ({ metrics }) => {
    
    // Prepare data for the mini residuals chart
    const residualsData = metrics.residuals_trend.map((val, idx) => ({
        index: idx,
        value: val
    }));

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-8">
            {/* Header */}
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h3 className="font-bold text-slate-800 flex items-center gap-2">
                        <BrainCircuit className="w-5 h-5 text-purple-600" />
                        AI Model Health & Analytics
                    </h3>
                    <p className="text-xs text-slate-500 mt-1">Hybrid Baseline: Clear-Sky Physics × Empirical Correction</p>
                </div>
                <div className="flex gap-3 text-xs">
                     <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        <span className="text-slate-400">Ver:</span>
                        <span className="font-mono font-bold text-slate-700">{metrics.version}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-sm">
                        <RefreshCw className="w-3 h-3 text-slate-400" />
                        <span className="text-slate-500">Last Train:</span>
                        <span className="font-medium text-slate-700">{metrics.last_trained.split('T')[0]}</span>
                    </div>
                </div>
            </div>
            
            <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                
                {/* 1. Evaluation Metrics */}
                <div className="lg:col-span-1 space-y-4">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-2">
                        <LineChart className="w-4 h-4" /> Regression Performance
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="text-xs text-slate-500 mb-1">RMSE</div>
                            <div className="text-2xl font-bold text-slate-800">{metrics.rmse} <span className="text-xs font-normal text-slate-400">kWh</span></div>
                            <div className="w-full bg-slate-200 h-1 mt-2 rounded-full"><div className="bg-purple-500 h-full w-[85%]"></div></div>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-lg border border-slate-100">
                            <div className="text-xs text-slate-500 mb-1">MAPE</div>
                            <div className="text-2xl font-bold text-slate-800">{metrics.mape}%</div>
                             <div className="w-full bg-slate-200 h-1 mt-2 rounded-full"><div className="bg-blue-500 h-full w-[92%]"></div></div>
                        </div>
                    </div>

                    {/* Residuals Sparkline */}
                    <div className="h-16 w-full pt-2">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={residualsData}>
                                <Tooltip wrapperStyle={{display: 'none'}} />
                                <Area type="monotone" dataKey="value" stroke="#94a3b8" fill="#f1f5f9" strokeWidth={1.5} />
                            </AreaChart>
                        </ResponsiveContainer>
                        <p className="text-[10px] text-center text-slate-400 mt-1">20-Point Residuals Trend (Actual vs Predicted)</p>
                    </div>
                </div>

                {/* 2. Anomaly Detection Performance */}
                <div className="lg:col-span-2">
                     <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-4 flex items-center gap-2">
                        <Target className="w-4 h-4" /> Anomaly Detection (Isolation Forest)
                    </h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        {/* Confusion Matrix Viz */}
                        <div className="col-span-1 sm:col-span-2 bg-slate-50 rounded-lg p-4 border border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-xs font-semibold text-slate-600">Model Precision/Recall</span>
                                <span className="text-[10px] bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-500">Threshold: 2σ</span>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">Precision</span>
                                    <span className="text-sm font-bold text-slate-700">{metrics.anomaly_detection.precision}</span>
                                </div>
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full" style={{width: `${metrics.anomaly_detection.precision * 100}%`}}></div>
                                </div>
                                
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">Recall</span>
                                    <span className="text-sm font-bold text-slate-700">{metrics.anomaly_detection.recall}</span>
                                </div>
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full" style={{width: `${metrics.anomaly_detection.recall * 100}%`}}></div>
                                </div>

                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500">F1 Score</span>
                                    <span className="text-sm font-bold text-slate-700">{metrics.anomaly_detection.f1_score}</span>
                                </div>
                                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-blue-500 h-full" style={{width: `${metrics.anomaly_detection.f1_score * 100}%`}}></div>
                                </div>
                            </div>
                        </div>

                        {/* Summary Stats */}
                        <div className="space-y-3">
                            <div className="bg-red-50 p-3 rounded-lg border border-red-100 flex items-start gap-3">
                                <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                                <div>
                                    <div className="text-lg font-bold text-red-700">{metrics.anomaly_detection.total_anomalies_detected}</div>
                                    <div className="text-xs text-red-600 leading-tight">Total Anomalies Detected</div>
                                </div>
                            </div>
                            <div className="bg-green-50 p-3 rounded-lg border border-green-100 flex items-start gap-3">
                                <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                                <div>
                                    <div className="text-lg font-bold text-green-700">99.8%</div>
                                    <div className="text-xs text-green-600 leading-tight">System Availability</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
