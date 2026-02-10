
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { logger } from '../utils/logger.js';

let wss: WebSocketServer;

// O(1) Lookup Maps for Scalability
// Global set of all clients for admin broadcasts
const allClients = new Set<WebSocket>();

// Map: SchoolId -> Set of WebSockets (Subscribed to that school)
const schoolSubscriptions = new Map<string, Set<WebSocket>>();

// Set: Clients subscribed to 'all' schools (e.g., Admin Dashboard)
const globalSubscribers = new Set<WebSocket>();

// Now accepts the HTTP server to attach WebSocket to the same port (required for Render)
export const initWebSocketServer = (server: Server) => {
    wss = new WebSocketServer({ server });

    wss.on('connection', (ws: WebSocket) => {
        logger.debug('✅ New WebSocket client connected');
        allClients.add(ws);

        ws.on('message', (message: string) => {
            try {
                const data = JSON.parse(message.toString());
                // logger.debug({ type: data.type }, 'Received WS message'); // Reduce noise

                if (data.type === 'subscribe') {
                    handleSubscription(ws, data.schoolId);
                }
            } catch (error) {
                logger.error({ err: error }, 'WebSocket message error');
            }
        });

        ws.on('close', () => {
            handleDisconnect(ws);
        });

        ws.on('error', (error) => {
            logger.error({ err: error }, 'WebSocket error');
            handleDisconnect(ws);
        });

        // Send confirmation
        safeSend(ws, {
            type: 'connected',
            message: 'Connected to PowerTrack WebSocket server',
            timestamp: new Date().toISOString(),
        });
    });

    logger.info('🔌 WebSocket server attached to HTTP server');
};

// Helper to handle subscription logic
const handleSubscription = (ws: WebSocket, schoolId: string) => {
    // 1. Cleanup previous subscription if exists
    const previousSchoolId = (ws as any).subscriptionId;
    if (previousSchoolId) {
        if (previousSchoolId === 'all') {
            globalSubscribers.delete(ws);
        } else {
            const set = schoolSubscriptions.get(previousSchoolId);
            if (set) {
                set.delete(ws);
                if (set.size === 0) schoolSubscriptions.delete(previousSchoolId);
            }
        }
    }

    // 2. Add new subscription
    (ws as any).subscriptionId = schoolId; // Tag for reverse lookup

    if (schoolId === 'all') {
        globalSubscribers.add(ws);
        logger.debug('Client subscribed to ALL schools');
    } else if (schoolId) {
        if (!schoolSubscriptions.has(schoolId)) {
            schoolSubscriptions.set(schoolId, new Set());
        }
        schoolSubscriptions.get(schoolId)!.add(ws);
        logger.debug({ schoolId }, 'Client subscribed to school');
    }
};

// Helper to handle disconnect
const handleDisconnect = (ws: WebSocket) => {
    allClients.delete(ws);

    const schoolId = (ws as any).subscriptionId;
    if (!schoolId) return;

    if (schoolId === 'all') {
        globalSubscribers.delete(ws);
    } else {
        const set = schoolSubscriptions.get(schoolId);
        if (set) {
            set.delete(ws);
            if (set.size === 0) schoolSubscriptions.delete(schoolId);
        }
    }
};

// Helper: Safe Send
const safeSend = (ws: WebSocket, payload: any) => {
    if (ws.readyState === WebSocket.OPEN) {
        try {
            ws.send(JSON.stringify(payload));
        } catch (err) {
            logger.error({ err }, 'Failed to send WS message');
        }
    }
};

// =========================================================
// BROADCASTING LOGIC (Optimized)
// =========================================================

const lastBroadcastTimes = new Map<string, number>();
const BROADCAST_THROTTLE_MS = 1000; // 1 second
const broadcastTimers = new Map<string, NodeJS.Timeout>();

export const broadcastTelemetryUpdate = (telemetryData: any) => {
    const schoolId = telemetryData.school_id;
    const now = Date.now();
    const lastTime = lastBroadcastTimes.get(schoolId) || 0;

    // Clear trailing timer
    if (broadcastTimers.has(schoolId)) {
        clearTimeout(broadcastTimers.get(schoolId)!);
        broadcastTimers.delete(schoolId);
    }

    // Throttle check
    if (now - lastTime < BROADCAST_THROTTLE_MS) {
        const delay = BROADCAST_THROTTLE_MS - (now - lastTime);
        const timer = setTimeout(() => {
            lastBroadcastTimes.set(schoolId, Date.now());
            _sendToSubscribers(schoolId, telemetryData);
            broadcastTimers.delete(schoolId);
        }, delay);
        broadcastTimers.set(schoolId, timer);
        return;
    }

    lastBroadcastTimes.set(schoolId, now);
    _sendToSubscribers(schoolId, telemetryData);
};

const _sendToSubscribers = (schoolId: string, data: any) => {
    const payload = {
        type: 'telemetry_update',
        data: data,
        timestamp: new Date().toISOString(),
    };

    // 1. Send to School Subscribers (O(1) Lookup)
    const schoolSet = schoolSubscriptions.get(schoolId);
    if (schoolSet) {
        for (const client of schoolSet) {
            safeSend(client, payload);
        }
    }

    // 2. Send to Global Subscribers (Admins)
    for (const client of globalSubscribers) {
        safeSend(client, payload);
    }
};

export const broadcastAlert = (alertData: any) => {
    const payload = {
        type: 'alert',
        data: alertData,
        timestamp: new Date().toISOString(),
    };

    // Alerts are critical, send to specific school subs AND global
    const schoolId = alertData.school_id;

    if (schoolId) {
        const schoolSet = schoolSubscriptions.get(schoolId);
        if (schoolSet) {
            for (const client of schoolSet) safeSend(client, payload);
        }
    }

    for (const client of globalSubscribers) {
        safeSend(client, payload);
    }
};

export const broadcastSchoolCreated = (schoolData: any) => {
    // New schools are interesting to Global Subscribers (Admins/Map)
    // They are NOT interesting to existing single-school dashboards
    const payload = {
        type: 'school_created',
        data: schoolData,
        timestamp: new Date().toISOString(),
    };

    for (const client of globalSubscribers) {
        safeSend(client, payload);
    }
};

export { wss };
