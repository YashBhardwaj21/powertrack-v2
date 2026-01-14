
import { DashboardData, Telemetry, Alert, CommunityStats } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

// Helper to get auth token
const getAuthToken = () => localStorage.getItem('auth_token');

// Helper to make authenticated requests
const fetchWithAuth = async (url: string, options: RequestInit = {}) => {
    const token = getAuthToken();
    const headers: any = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        return await fetch(url, {
            ...options,
            headers,
        });
    } catch (error: any) {
        console.error(`Fetch error for ${url}:`, error);
        throw error;
    }
};

export const fetchDashboardData = async (schoolId?: string): Promise<DashboardData> => {
    const url = schoolId
        ? `${API_BASE}/dashboard/summary?school_id=${schoolId}`
        : `${API_BASE}/dashboard/summary`;

    const response = await fetchWithAuth(url);

    if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
    }

    return await response.json();
};

export const fetchPublicLeaderboard = async (): Promise<any[]> => {
    try {
        const response = await fetch(`${API_BASE}/dashboard/leaderboard`);

        if (!response.ok) {
            console.error('Failed to fetch leaderboard');
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error('Leaderboard fetch error:', error);
        return [];
    }
};

export const fetchSchoolLogs = async (schoolId: string): Promise<Telemetry[]> => {
    try {
        const response = await fetchWithAuth(
            `${API_BASE}/dashboard/energy-logs?school_id=${schoolId}&limit=50`
        );

        if (!response.ok) {
            console.error('Failed to fetch school logs');
            return [];
        }

        return await response.json();
    } catch (error) {
        console.error('School logs fetch error:', error);
        return [];
    }
};

export const createSchool = async (schoolData: {
    name: string;
    type: string;
    district: string;
    latitude: number;
    longitude: number;
    total_capacity_kwp: number;
    total_cost_idr: number;
}) => {
    const response = await fetchWithAuth(`${API_BASE}/schools`, {
        method: 'POST',
        body: JSON.stringify(schoolData),
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create school');
    }

    return await response.json();
};

// WebSocket connection for real-time updates
let ws: WebSocket | null = null;

export const subscribeToTelemetry = (
    schoolId: string | null,
    onData: (data: Telemetry[], alerts: Alert[], community: CommunityStats) => void
) => {
    // Close existing connection if any
    if (ws) {
        ws.close();
    }

    // Create WebSocket connection
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('✅ WebSocket connected');

        // Subscribe to specific school or all schools
        ws?.send(JSON.stringify({
            type: 'subscribe',
            schoolId: schoolId || 'all',
        }));
    };

    ws.onmessage = async (event) => {
        try {
            const message = JSON.parse(event.data);

            if (message.type === 'telemetry_update' || message.type === 'alert') {
                // Fetch fresh dashboard data when update received
                const dashboardData = await fetchDashboardData(schoolId || undefined);
                onData(
                    dashboardData.current_data,
                    dashboardData.alerts,
                    dashboardData.community_stats
                );
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
        console.log('❌ WebSocket disconnected');

        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
            if (ws?.readyState === WebSocket.CLOSED) {
                console.log('🔄 Attempting to reconnect WebSocket...');
                subscribeToTelemetry(schoolId, onData);
            }
        }, 5000);
    };

    // Return cleanup function
    return () => {
        if (ws) {
            ws.close();
            ws = null;
        }
    };
};
