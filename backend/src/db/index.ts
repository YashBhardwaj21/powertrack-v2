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

// Test database connection
pool.on('connect', () => {
    logger.debug('✅ Database connected successfully');
});

pool.on('error', (err) => {
    logger.error({ err }, '❌ Unexpected database error (trying to recover)');
    // process.exit(-1); // Don't crash on transient connection errors
});

// Helper function to execute queries
export const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        // Optimization: Only log slow queries (>100ms) or in dev mode to reduce noise
        if (duration > 100 || config.nodeEnv === 'development') {
            logger.debug({ text, duration, rows: res.rowCount }, 'Executed query');
        }
        return res;
    } catch (error) {
        logger.error({ err: error, text }, 'Database query error');
        throw error;
    }
};

// Helper to get a client from the pool for transactions
export const getClient = async () => {
    return await pool.connect();
};

export default { pool, query, getClient };
