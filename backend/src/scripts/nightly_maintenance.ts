
import pg from 'pg';
import { config } from '../config/index.js';

const { Client } = pg;

// Connection config
const dbConfig = {
    connectionString: config.databaseUrl,
    ssl: config.databaseUrl?.includes('localhost') ? false : { rejectUnauthorized: false }
};

async function main() {
    console.log('🌙 Starting Nightly Maintenance Job...');
    const client = new Client(dbConfig);

    try {
        await client.connect();

        // 1. Calculate Yesterday's Date
        // We aggregate for the full previous day (e.g. at 2 AM on Feb 5, we aggregate Feb 4)
        const result = await client.query(`SELECT (CURRENT_DATE - INTERVAL '1 day')::date as yesterday`);
        const targetDate = result.rows[0].yesterday;

        console.log(`📊 Aggregating stats for date: ${targetDate}`);

        // 2. Run Aggregation Stored Procedure
        const start = Date.now();
        await client.query('CALL public.aggregate_daily_stats($1)', [targetDate]);
        const duration = Date.now() - start;

        console.log(`✅ Aggregation complete in ${duration}ms`);

        // 3. (Optional) Future: Add Partition Dropping here
        // await client.query('CALL public.drop_old_partitions()');

        process.exit(0);
    } catch (err) {
        console.error('❌ Nightly Job Failed:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
