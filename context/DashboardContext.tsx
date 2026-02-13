
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { DashboardData, Telemetry, Alert, CommunityStats } from '../types';
import { fetchDashboardData, subscribeToTelemetry } from '../services/dataService';

interface DashboardContextType {
    data: DashboardData | null;
    loading: boolean;
    lastUpdated: string;
    isConnected: boolean;
    error: string | null;
    needsSchoolAssignment: boolean;
    status: 'loading' | 'needs_assignment' | 'ready' | 'empty' | 'error';
    locale: 'en' | 'id';
    setLocale: (l: 'en' | 'id') => void;
    granularity: '1h' | '15min';
    setGranularity: (g: '1h' | '15min') => void;
    refresh: () => Promise<void>;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [needsSchoolAssignment, setNeedsSchoolAssignment] = useState(false);
    const [status, setStatus] = useState<'loading' | 'needs_assignment' | 'ready' | 'empty' | 'error'>('loading');
    const [locale, setLocale] = useState<'en' | 'id'>('en');
    const [granularity, setGranularity] = useState<'1h' | '15min'>('1h');

    // Track if we've successfully loaded data at least once to avoid full-screen spinners on refresh
    const hasLoadedRef = React.useRef(false);

    const refresh = React.useCallback(async () => {
        try {
            // Silent Refresh: Only show full loading spinner on the very first load
            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const initialData = await fetchDashboardData(undefined, granularity);
            setData(initialData);
            setLoading(false);
            setIsConnected(true);
            hasLoadedRef.current = true;

            if (initialData.needs_school_assignment) {
                setNeedsSchoolAssignment(true);
                setStatus('needs_assignment');
            } else if (!initialData.schools || initialData.schools.length === 0) {
                setStatus('empty');
            } else {
                setStatus('ready');
            }
        } catch (err) {
            console.error('Failed to initialize dashboard:', err);
            setError('Failed to load dashboard data. Please check your connection.');
            setLoading(false);
            setStatus('error');
        }
    }, [granularity]);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        refresh();

        const pulseInterval = setInterval(() => {
            refresh();
        }, 30000);

        unsubscribe = subscribeToTelemetry(null, (message) => {
            if (message.type === 'telemetry_update' && message.data) {
                setData(current => {
                    if (!current) return current;

                    const next = { ...current };
                    const updatedTelemetry = message.data;
                    const existingIndex = next.current_data.findIndex(d => d.school_id === updatedTelemetry.school_id);

                    if (existingIndex >= 0) {
                        next.current_data[existingIndex] = updatedTelemetry;
                    } else {
                        next.current_data.push(updatedTelemetry);
                    }

                    return next;
                });
                setLastUpdated(new Date().toLocaleTimeString());
            } else if (message.type === 'alert') {
                // Alerts: could trigger refresh() if critical; for now just accept live data
            }
        });

        return () => {
            clearInterval(pulseInterval);
            if (unsubscribe) unsubscribe();
        };
    }, [refresh]);

    return (
        <DashboardContext.Provider value={{ data, loading, lastUpdated, isConnected, error, needsSchoolAssignment, status, locale, setLocale, granularity, setGranularity, refresh }}>
            {children}
        </DashboardContext.Provider>
    );
};

export const useDashboard = () => {
    const context = useContext(DashboardContext);
    if (context === undefined) {
        throw new Error('useDashboard must be used within a DashboardProvider');
    }
    return context;
};
