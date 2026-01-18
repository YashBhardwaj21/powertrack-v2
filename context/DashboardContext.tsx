
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

    const refresh = React.useCallback(async () => {
        try {
            console.log('[DashboardContext] Starting refresh...');
            setLoading(true);
            const initialData = await fetchDashboardData();
            console.log('[DashboardContext] Fetched data:', {
                schoolCount: initialData.schools?.length,
                schools: initialData.schools?.map(s => ({ id: s.id, name: s.name, deleted_at: (s as any).deleted_at }))
            });
            setData(initialData);
            setLoading(false);
            setIsConnected(true);

            if (initialData.needs_school_assignment) {
                setNeedsSchoolAssignment(true);
                setStatus('needs_assignment');
            } else if (!initialData.schools || initialData.schools.length === 0) {
                // Explicit empty state if no schools are present (and not waiting for assignment)
                setStatus('empty');
            } else {
                setStatus('ready');
            }
            console.log('[DashboardContext] Refresh complete');
        } catch (err) {
            console.error('Failed to initialize dashboard:', err);
            setError('Failed to load dashboard data. Please check your connection.');
            setLoading(false);
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        refresh();

        // 🔄 Live Pulse: Periodically re-fetch dashboard to check for architectural changes
        // (e.g. School Archival, Role Change, Deployment Updates)
        const pulseInterval = setInterval(() => {
            refresh();
        }, 30000); // Check every 30 seconds

        // Start "MQTT" subscription
        unsubscribe = subscribeToTelemetry(null, (telemetry, alerts, community) => {
            setData(current => {
                if (!current) return null;
                const updated = {
                    ...current,
                    current_data: telemetry,
                    alerts,
                    community_stats: community
                };
                return updated;
            });
            setLastUpdated(new Date().toLocaleTimeString());
        });

        return () => {
            clearInterval(pulseInterval);
            if (unsubscribe) unsubscribe();
        };
    }, []);

    return (
        <DashboardContext.Provider value={{ data, loading, lastUpdated, isConnected, error, needsSchoolAssignment, status, locale, setLocale, refresh }}>
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
