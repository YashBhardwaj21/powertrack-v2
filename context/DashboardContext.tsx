
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
            console.log('[DashboardContext] Starting refresh...', { granularity });

            // Silent Refresh: Only show full loading spinner on the very first load
            if (!hasLoadedRef.current) {
                setLoading(true);
            }

            const initialData = await fetchDashboardData(undefined, granularity);
            console.log('[DashboardContext] Fetched data:', {
                schoolCount: initialData.schools?.length,
                schools: initialData.schools?.map(s => ({ id: s.id, name: s.name, deleted_at: (s as any).deleted_at }))
            });
            setData(initialData);
            setLoading(false);
            setIsConnected(true);
            hasLoadedRef.current = true; // Mark as loaded so future refreshes are silent

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
        unsubscribe = subscribeToTelemetry(null, (message) => {
            if (message.type === 'telemetry_update' && message.data) {
                setData(current => {
                    if (!current) return current;

                    // Deep clone to avoid mutation
                    const next = { ...current };

                    // 1. Update current_data (Live Telemetry)
                    const updatedTelemetry = message.data;
                    const existingIndex = next.current_data.findIndex(d => d.school_id === updatedTelemetry.school_id);

                    if (existingIndex >= 0) {
                        // Replace existing
                        next.current_data[existingIndex] = updatedTelemetry;
                    } else {
                        // Append new (and sort/trim if needed, but for now just push)
                        next.current_data.push(updatedTelemetry);
                    }

                    // 2. Update Schools list (Last Seen / Status) if necessary
                    // (The school list doesn't usually carry telemetry, but if we had a status field there, we'd update it)

                    return next;
                });
                setLastUpdated(new Date().toLocaleTimeString());
            } else if (message.type === 'alert') {
                // For alerts, we might still want to re-fetch or just append. 
                // Alerts are less frequent, so a re-fetch is safer/easier, or just ignore for now if not critical.
                // Let's just log it for now to avoid complexity, or trigger a refresh if it's critical.
                console.log('[DashboardContext] Alert received:', message.data);
                // Optional: refresh(); 
            }
        });

        return () => {
            clearInterval(pulseInterval);
            if (unsubscribe) unsubscribe();
        };
    }, []);

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
