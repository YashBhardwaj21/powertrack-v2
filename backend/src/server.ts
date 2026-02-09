import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http'; // Industry standard request logging
import { config } from './config/index.js';
import { pool } from './db/index.js';
import { initWebSocketServer } from './websocket/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { logger } from './utils/logger.js'; // Structured logging

// 🔥 ====== ADDED LINE #1 ======
import { startSimulator, stopSimulator } from './simulator.js';
// 🔥 ===========================

// Import routes
import authRoutes from './routes/auth.js';
import telemetryRoutes from './routes/telemetry.js';
import dashboardRoutes from './routes/dashboard.js';
import schoolsRoutes from './routes/schools.js';
import adminRoutes from './routes/admin.js';
import deviceProfileRoutes from './routes/deviceProfiles.js';

const app = express();

// Middleware
app.use(helmet());
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps or curl requests)
        if (!origin) return callback(null, true);

        // 🔥 Allow all in development (Fixes LAN/IP access issues)
        if (config.nodeEnv === 'development') {
            return callback(null, true);
        }

        if (config.frontendUrls.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            logger.warn({ origin }, 'CORS blocked request from unauthorized origin');
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
}));

// Request Logger (Async & Structured)
app.use(pinoHttp({
    logger,
    autoLogging: {
        ignore: (req) => req.url?.includes('/health') || false, // Ignore health checks to reduce noise
    },
    genReqId: (req) => req.headers['x-request-id'] || req.id || crypto.randomUUID(), // Industry standard correlation ID
    customLogLevel: (req, res, err) => {
        if (res.statusCode >= 500 || err) return 'error';
        if (res.statusCode >= 400) return 'warn';
        return 'info';
    },
    // redact: ['req.headers.authorization'] // Handled by main logger
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
app.use('/api/', apiLimiter);

// Root health check (for Render/Cloudflare probes)
app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'powertrack-backend' });
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

import versionRoutes from './routes/version.js';
import v2Routes from './routes/v2/index.js';

// API Routes
app.use('/api/v1/version', versionRoutes);
app.use('/api/v2', v2Routes); // Fix 24: Versioning Strategy
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/telemetry', telemetryRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/schools', schoolsRoutes);
app.use('/api/v1/device-profiles', deviceProfileRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error({ err }, 'Unhandled Request Error'); // Structured error logging
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
    });
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        await pool.query('SELECT NOW()');
        logger.info('✅ Database connection successful');

        // Create HTTP server wrapping Express (required for WebSocket on same port)
        const server = createServer(app);

        // Attach WebSocket to the same HTTP server (required for Render - single port)
        initWebSocketServer(server);

        // Start the unified HTTP + WebSocket server
        server.listen(config.port, () => {
            logger.info({
                port: config.port,
                env: config.nodeEnv,
                url: `http://localhost:${config.port}/api/v1`
            }, '🚀 Server started (HTTP + WebSocket on same port)');
        });

        // 🔥 ====== ADDED LINE #2 ======
        startSimulator().catch(err => logger.error({ err }, 'Simulator startup failed'));
        // 🔥 ===========================

        // 🔥 Pre-warm critical caches on startup (eliminates first-request latency)
        try {
            const { dashboardService } = await import('./services/dashboardService.js');
            await dashboardService.getSystemParams(['electricity_tariff_idr', 'carbon_factor_kg_kwh']);
            logger.info('✅ System parameters cache pre-warmed');
        } catch (err) {
            logger.warn({ err }, 'Cache pre-warm failed (non-critical)');
        }

        // 🔄 Keep database connection alive (prevents Render/Supabase cold starts)
        setInterval(async () => {
            try {
                await pool.query('SELECT 1');
                logger.debug('Database keep-alive ping');
            } catch (err) {
                logger.error({ err }, 'Database keep-alive failed');
            }
        }, 180000); // 3 minutes

    } catch (error) {
        logger.fatal({ err: error }, '❌ Failed to start server');
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');

    // 🔥 ====== ADDED LINE #3 ======
    stopSimulator();
    // 🔥 ===========================

    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');

    // 🔥 ====== ADDED LINE #4 ======
    stopSimulator();
    // 🔥 ===========================

    await pool.end();
    process.exit(0);
});

startServer();
