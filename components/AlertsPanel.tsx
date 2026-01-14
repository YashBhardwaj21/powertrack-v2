
import React from 'react';
import { Alert, FaultType } from '../types';
import { AlertTriangle, WifiOff, Zap, Activity, CheckCircle } from 'lucide-react';

interface AlertsPanelProps {
    alerts: Alert[];
}

const getAlertIcon = (type: FaultType) => {
    switch (type) {
        case 'comm_down': return <WifiOff className="w-4 h-4" />;
        case 'ground_fault':
        case 'arc_fault': return <Zap className="w-4 h-4" />;
        case 'underperf': return <Activity className="w-4 h-4" />;
        default: return <AlertTriangle className="w-4 h-4" />;
    }
};

const getSeverityStyles = (severity: string) => {
    switch (severity) {
        case 'critical': return 'bg-red-50 text-red-700 border-red-200';
        case 'warning': return 'bg-amber-50 text-amber-700 border-amber-200';
        default: return 'bg-blue-50 text-blue-700 border-blue-200';
    }
};

export const AlertsPanel: React.FC<AlertsPanelProps> = ({ alerts }) => {
    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden h-full flex flex-col">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
                <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                    Active Incidents
                </h3>
                <span className={`text-xs px-2 py-1 rounded-full font-medium ${alerts.length > 0 ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {alerts.length} Active
                </span>
            </div>
            
            <div className="overflow-y-auto p-4 space-y-3 flex-grow custom-scrollbar" style={{maxHeight: '300px'}}>
                {alerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 py-8">
                        <CheckCircle className="w-12 h-12 mb-2 text-green-400" />
                        <p className="text-sm">All systems nominal</p>
                    </div>
                ) : (
                    alerts.map(alert => (
                        <div key={alert.id} className={`p-3 rounded-lg border flex items-start gap-3 ${getSeverityStyles(alert.severity)}`}>
                            <div className="mt-0.5 flex-shrink-0">
                                {getAlertIcon(alert.type)}
                            </div>
                            <div className="flex-grow">
                                <div className="flex justify-between items-start">
                                    <span className="font-bold text-sm">{alert.school_name}</span>
                                    <span className="text-[10px] opacity-75 uppercase tracking-wider">{alert.timestamp.split('T')[1].substring(0,8)}</span>
                                </div>
                                <p className="text-xs mt-1 font-medium">{alert.message}</p>
                                <p className="text-[10px] mt-1 opacity-80">ID: {alert.school_id}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
