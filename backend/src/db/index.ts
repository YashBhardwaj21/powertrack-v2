import pg from 'pg';
import { config } from '../config/index.js';

const { Pool } = pg;

// Create PostgreSQL connection pool
const poolConfig = {
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl?.includes('localhost') ? false : { rejectUnauthorized: false },
    max: 20, // Reduced from 100 to prevent starvation
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 30000, // Increased to 30s to handle slow starts
    keepAlive: true,
};

import { logger } from '../utils/logger.js';

// Create PostgreSQL connection pool
export const pool = new Pool(poolConfig);

// Pool health monitoring
pool.on('connect', () => {
    logger.info('✅ DB pool connected');
});

pool.on('error', (err) => {
    logger.error({ err }, '❌ DB pool error');
});

pool.on('remove', () => {
    logger.debug('Client removed from pool');
});

// Log pool stats periodically (every minute)
setInterval(() => {
    logger.debug({
        total: pool.totalCount,
        idle: pool.idleCount,
        waiting: pool.waitingCount
    }, '📊 DB Pool Stats');
}, 60000);

// Helper function to execute queries with enhanced logging
export const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;

        // Log slow queries (>1000ms)
        if (duration > 1000) {
            logger.warn({ duration, query: text.substring(0, 100) }, 'Slow query');
        }

        // Debug logging in development
        if (config.nodeEnv === 'development' && duration > 100) {
            logger.debug({ text: text.substring(0, 100), duration, rows: res.rowCount }, 'Executed query');
        }

        return res;
    } catch (error) {
        logger.error({ err: error, query: text.substring(0, 100) }, 'Query error');
        throw error;
    }
};

// Helper to get a client from the pool for transactions
export const getClient = async () => {
    return await pool.connect();
};

export default { pool, query, getClient };
