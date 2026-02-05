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

// Create PostgreSQL connection pool
export const pool = new Pool(poolConfig);

// Test database connection
pool.on('connect', () => {
    console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error (trying to recover):', err);
    // process.exit(-1); // Don't crash on transient connection errors
});

// Helper function to execute queries
export const query = async (text: string, params?: any[]) => {
    const start = Date.now();
    try {
        const res = await pool.query(text, params);
        const duration = Date.now() - start;
        console.log('Executed query', { text, duration, rows: res.rowCount });
        return res;
    } catch (error) {
        console.error('Database query error:', error);
        throw error;
    }
};

// Helper to get a client from the pool for transactions
export const getClient = async () => {
    return await pool.connect();
};

export default { pool, query, getClient };
