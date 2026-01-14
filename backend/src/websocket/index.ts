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

export const broadcastTelemetryUpdate = (telemetryData: any) => {
    const message = JSON.stringify({
        type: 'telemetry_update',
        data: telemetryData,
        timestamp: new Date().toISOString(),
    });

    clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            // Only send to clients subscribed to this school or all schools
            const clientSchoolId = (client as any).schoolId;
            if (!clientSchoolId || clientSchoolId === telemetryData.school_id || clientSchoolId === 'all') {
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
