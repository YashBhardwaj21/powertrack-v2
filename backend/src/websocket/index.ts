import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../config/index.js';

let wss: WebSocketServer;
const clients = new Set<WebSocket>();

export const initWebSocketServer = () => {
    wss = new WebSocketServer({ port: config.wsPort });

    wss.on('connection', (ws: WebSocket) => {
        console.log('✅ New WebSocket client connected');
        clients.add(ws);

        ws.on('message', (message: string) => {
            try {
                const data = JSON.parse(message.toString());
                console.log('Received message:', data);

                // Handle different message types
                if (data.type === 'subscribe') {
                    // Client wants to subscribe to specific school updates
                    (ws as any).schoolId = data.schoolId;
                }
            } catch (error) {
                console.error('WebSocket message error:', error);
            }
        });

        ws.on('close', () => {
            console.log('❌ WebSocket client disconnected');
            clients.delete(ws);
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
            clients.delete(ws);
        });

        // Send initial connection confirmation
        ws.send(JSON.stringify({
            type: 'connected',
            message: 'Connected to PowerTrack WebSocket server',
            timestamp: new Date().toISOString(),
        }));
    });

    console.log(`🔌 WebSocket server running on port ${config.wsPort}`);
};

const lastBroadcastTimes = new Map<string, number>();
const BROADCAST_THROTTLE_MS = 2000;

const broadcastTimers = new Map<string, NodeJS.Timeout>();

export const broadcastTelemetryUpdate = (telemetryData: any) => {
    const schoolId = telemetryData.school_id;
    const now = Date.now();
    const lastTime = lastBroadcastTimes.get(schoolId) || 0;

    // Clear any pending trailing broadcast
    if (broadcastTimers.has(schoolId)) {
        clearTimeout(broadcastTimers.get(schoolId)!);
        broadcastTimers.delete(schoolId);
    }

    if (now - lastTime < BROADCAST_THROTTLE_MS) {
        // Schedule trailing broadcast
        const delay = BROADCAST_THROTTLE_MS - (now - lastTime);
        const timer = setTimeout(() => {
            // Re-verify valid WS connection state if needed, but here simple recursive call or direct send
            // Better to directly send to avoid loop, or set lastTime and send.
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
    const message = JSON.stringify({
        type: 'telemetry_update',
        data: data,
        timestamp: new Date().toISOString(),
    });

    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            const clientSchoolId = (client as any).schoolId;
            if (!clientSchoolId || clientSchoolId === schoolId || clientSchoolId === 'all') {
                client.send(message);
            }
        }
    });
};

export const broadcastAlert = (alertData: any) => {
    const message = JSON.stringify({
        type: 'alert',
        data: alertData,
        timestamp: new Date().toISOString(),
    });

    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
};

export { wss };
