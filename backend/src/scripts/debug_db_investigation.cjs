const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function runDebug() {
    try {
        console.log('--- DB DEBUG START ---');

        // 1. Check Schools
        const schoolsRes = await pool.query('SELECT id, name, timezone, total_capacity_kwp, api_key_hash FROM schools');
        console.log('Schools:', JSON.stringify(schoolsRes.rows, null, 2));

        if (schoolsRes.rows.length === 0) {
            console.log('CRITICAL: No schools found!');
        }

        // 2. Check recent telemetry counts
        const recentTelemetry = await pool.query(`
            SELECT school_id, count(*) 
            FROM telemetry 
            WHERE timestamp > NOW() - INTERVAL '24 hours' 
            GROUP BY school_id
        `);
        console.log('Recent Telemetry Counts (24h):', JSON.stringify(recentTelemetry.rows, null, 2));

        // 3. Check latest telemetry data checks
        const latestTelemetry = await pool.query(`
            SELECT DISTINCT ON (school_id) 
                school_id, 
                timestamp, 
                total_energy_kwh, 
                daily_energy_kwh, 
                ac_power_kw
            FROM telemetry
            ORDER BY school_id, timestamp DESC
        `);
        console.log('Latest Telemetry per School:', JSON.stringify(latestTelemetry.rows, null, 2));

        // 4. Check Simulator State
        const simState = await pool.query('SELECT * FROM simulator_state');
        console.log('Simulator State:', JSON.stringify(simState.rows, null, 2));

        // 5. Check System Parameters
        const sysParams = await pool.query('SELECT * FROM system_parameters');
        console.log('System Parameters:', JSON.stringify(sysParams.rows, null, 2));

        console.log('--- DB DEBUG END ---');
    } catch (error) {
        console.error('DEBUG ERROR:', error);
    } finally {
        await pool.end();
    }
}

runDebug();
