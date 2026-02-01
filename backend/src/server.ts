import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import { pool } from './db/index.js';
import { initWebSocketServer } from './websocket/index.js';
import { apiLimiter } from './middleware/rateLimit.js';

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
    console.error('Error:', err);
    res.status(err.status || 500).json({
        error: err.message || 'Internal server error',
    });
});

// Start server
const startServer = async () => {
    try {
        // Test database connection
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful');

        // Start Express server
        app.listen(config.port, () => {
            console.log(`🚀 Server running on port ${config.port}`);
            console.log(`📡 API available at http://localhost:${config.port}/api/v1`);
            console.log(`🌍 Environment: ${config.nodeEnv}`);
        });

        // Start WebSocket server
        initWebSocketServer();

    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

// Handle graceful shutdown
process.on('SIGTERM', async () => {
    console.log('SIGTERM received, shutting down gracefully...');
    await pool.end();
    process.exit(0);
});

process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down gracefully...');
    await pool.end();
    process.exit(0);
});

startServer();
