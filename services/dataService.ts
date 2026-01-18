
import { DashboardData, Telemetry, Alert, CommunityStats } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3002';

// Custom Error Class
export class ApiError extends Error {
    constructor(
        public message: string,
        public code?: string,
        public resolution?: string,
        public status?: number
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

// Helper to get auth token
const getAuthToken = () => localStorage.getItem('auth_token');

// Helper to make authenticated requests with Retry
const fetchWithAuth = async (url: string, options: RequestInit = {}, retries = 3, backoff = 500): Promise<Response> => {
    const token = getAuthToken();
    const headers: any = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    try {
        const response = await fetch(url, { ...options, headers });

        // 401: Always throw immediately to trigger logout/redirect
        if (response.status === 401) return response;

        // 5xx: Retryable
        if (!response.ok && response.status >= 500 && retries > 0) {
            throw new Error(`Server error ${response.status}`);
        }
        return response;
    } catch (error: any) {
        if (retries <= 0) throw error;
        await new Promise(r => setTimeout(r, backoff));
        return fetchWithAuth(url, options, retries - 1, backoff * 2);
    }
};

export const fetchDashboardData = async (schoolId?: string): Promise<DashboardData> => {
    const timestamp = new Date().getTime();
    const url = schoolId
        ? `${API_BASE}/dashboard/summary?school_id=${schoolId}&_t=${timestamp}`
        : `${API_BASE}/dashboard/summary?_t=${timestamp}`;

    const response = await fetchWithAuth(url);

    if (!response.ok) {
        if (response.status === 401) {
            throw new ApiError('Unauthorized', 'AUTH_EXPIRED', 'Please log in again', 401);
        }

        let errorBody: any = {};
        try { errorBody = await response.json(); } catch { }

        throw new ApiError(
            errorBody.error || `Failed to fetch dashboard data (${response.status})`,
            errorBody.code,
            errorBody.resolution,
            response.status
        );
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
    api_key?: string;
    device_profile_id?: string;
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

export const fetchUsers = async () => {
    const response = await fetchWithAuth(`${API_BASE}/admin/users`);
    if (!response.ok) throw new Error('Failed to fetch users');
    return await response.json();
};

export const assignUserToSchool = async (userId: string, schoolId: string | null, role: string) => {
    const response = await fetchWithAuth(`${API_BASE}/admin/assign-school`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, school_id: schoolId, role }),
    });
    if (!response.ok) throw new Error('Failed to assign user');
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

    // State for reconnection backoff
    let retryCount = 0;
    const maxRetries = 10;
    const baseDelay = 1000;
    let reconnectTimeout: any;

    const connect = () => {
        // Close existing connection if any
        if (ws) {
            ws.close();
        }

        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('✅ WebSocket connected');
            retryCount = 0; // Reset on success

            // Subscribe to specific school or all schools
            ws?.send(JSON.stringify({
                type: 'subscribe',
                schoolId: schoolId || 'all',
            }));
        };

        ws.onmessage = async (event) => {
            // ... existing message handling ...
            try {
                const message = JSON.parse(event.data);
                if (message.type === 'telemetry_update' || message.type === 'alert') {
                    const dashboardData = await fetchDashboardData(schoolId || undefined);
                    onData(dashboardData.current_data, dashboardData.alerts, dashboardData.community_stats);
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        };

        ws.onclose = () => {
            console.log(`❌ WebSocket disconnected. Retry ${retryCount}/${maxRetries}`);

            if (retryCount < maxRetries) {
                // Exponential Backoff with Jitter
                // delay = base * 2^retries + random(0-500ms)
                const backoff = baseDelay * Math.pow(2, retryCount);
                const jitter = Math.random() * 500;
                const delay = Math.min(backoff + jitter, 30000); // Cap at 30s

                reconnectTimeout = setTimeout(() => {
                    retryCount++;
                    connect();
                }, delay);
            } else {
                console.error('WebSocket max retries reached. Giving up.');
            }
        };

        ws.onerror = (error) => {
            console.error('WebSocket error:', error);
            // Verify if closing triggers onclose, usually yes.
        };
    };

    // Initial connect
    connect();

    // Return cleanup function
    return () => {
        if (ws) {
            ws.close();
            ws = null;
        }
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
        }
    };
};
