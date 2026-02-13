
import { DashboardData, Telemetry, Alert, CommunityStats } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api/v1';
const getWsUrl = () => {
    // If explicit env var is set (e.g. production), use it
    if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;

    // Otherwise, construct from window location (development robustness)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = '3001'; // Backend port
    return `${protocol}//${host}:${port}`;
};
const WS_URL = getWsUrl();

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
const getAuthToken = () => sessionStorage.getItem('auth_token');

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

export const fetchDashboardData = async (schoolId?: string, granularity: '1h' | '15min' = '1h'): Promise<DashboardData> => {
    const timestamp = new Date().getTime();
    let url = `${API_BASE}/dashboard/summary?_t=${timestamp}`;
    if (schoolId) url += `&school_id=${schoolId}`;
    if (granularity === '15min') url += `&granularity=15min`;

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

export const fetchPublicLeaderboard = async (): Promise<{ leaderboard: any[], metadata: any } | null> => {
    try {
        const response = await fetch(`${API_BASE}/dashboard/leaderboard?_t=${new Date().getTime()}`);

        if (!response.ok) {
            console.error('Failed to fetch leaderboard');
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('Leaderboard fetch error:', error);
        return null;
    }
};

export const fetchPublicHistory = async (): Promise<any[]> => {
    try {
        let url = `${API_BASE}/dashboard/public-metrics?granularity=15min`;
        // No longer filtering by school_id for public aggregate view

        const response = await fetch(url);
        if (!response.ok) return [];
        return await response.json();
    } catch (error) {
        console.error('Public history fetch error:', error);
        return [];
    }
};


export const fetchHourlyData = async (date: string): Promise<any[]> => {
    const response = await fetchWithAuth(`${API_BASE}/dashboard/hourly?date=${date}`);
    if (!response.ok) return [];
    return await response.json();
};

export const fetchAnalyticsRange = async (start: string, end: string): Promise<any> => {
    const response = await fetchWithAuth(`${API_BASE}/dashboard/analytics?start=${start}&end=${end}`);
    if (!response.ok) return { daily_series: [], stats: {} };
    return await response.json();
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
    latitude?: number;
    longitude?: number;
    total_capacity_kwp: number;
    total_cost_idr: number;
    timezone?: string;
    api_key?: string;
    device_profile_id?: string;
    connection_protocol?: 'http' | 'mqtt';
}): Promise<any> => {
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

export const archiveSchool = async (schoolId: string) => {
    const response = await fetchWithAuth(`${API_BASE}/schools/${schoolId}`, {
        method: 'DELETE'
    });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to archive organization');
    }
    return await response.json();
};

// WebSocket connection for real-time updates
let ws: WebSocket | null = null;

export const subscribeToTelemetry = (
    schoolId: string | null,
    onData: (message: any) => void
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
            // Pass the raw message to the context for merging
            onData(message);
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
            try {
                const message = JSON.parse(event.data);
                onData(message);
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
