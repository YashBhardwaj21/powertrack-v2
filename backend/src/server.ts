import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import pinoHttp from 'pino-http'; // Industry standard request logging
import { config } from './config/index.js';
import { pool } from './db/index.js';
import { initWebSocketServer } from './websocket/index.js';
import { apiLimiter } from './middleware/rateLimit.js';
import { logger } from './utils/logger.js'; // Structured logging

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
    origin: config.frontendUrl,
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

// ... (imports)

// Rate limiting
app.use('/api/', apiLimiter);

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

// ...

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

        // Start Express server
        app.listen(config.port, () => {
            logger.info({
                port: config.port,
                env: config.nodeEnv,
                url: `http://localhost:${config.port}/api/v1`
            }, '🚀 Server started');
        });

        // Start WebSocket server
        initWebSocketServer();

    } catch (error) {
        logger.fatal({ err: error }, '❌ Failed to start server');
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully...');
    await pool.end();
    process.exit(0);
});

startServer();
