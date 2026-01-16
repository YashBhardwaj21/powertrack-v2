
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { DashboardData, Telemetry, Alert, CommunityStats } from '../types';
import { fetchDashboardData, subscribeToTelemetry } from '../services/dataService';

interface DashboardContextType {
    data: DashboardData | null;
    loading: boolean;
    lastUpdated: string;
    isConnected: boolean;
    error: string | null;
    locale: 'en' | 'id';
    setLocale: (l: 'en' | 'id') => void;
}

const DashboardContext = createContext<DashboardContextType | undefined>(undefined);

export const DashboardProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [lastUpdated, setLastUpdated] = useState<string>('');
    const [isConnected, setIsConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [locale, setLocale] = useState<'en' | 'id'>('en');

    useEffect(() => {
        let unsubscribe: (() => void) | undefined;

        const init = async () => {
            try {
                const initialData = await fetchDashboardData();
                setData(initialData);
                setLoading(false);
                setIsConnected(true);

                // Start "MQTT" subscription
                unsubscribe = subscribeToTelemetry(null, (telemetry, alerts, community) => {
                    setData(prev => {
                        if (!prev) return null;
                        return {
                            ...prev,
                            current_data: telemetry || [],
                            alerts: alerts || [],
                            community_stats: community || prev.community_stats
                        };
                    });
                    setLastUpdated(new Date().toLocaleTimeString());
                });
            } catch (e) {
                console.error("Failed to initialize dashboard", e);
                setError("Failed to load system data. Please refresh.");
                setLoading(false);
            }
        };

        init();

        return () => {
            if (unsubscribe) unsubscribe();
        };
    }, []);

    return (
        <DashboardContext.Provider value={{ data, loading, lastUpdated, isConnected, error, locale, setLocale }}>
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
