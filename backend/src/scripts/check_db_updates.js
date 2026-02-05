import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/powertrack',
    ssl: false
});

async function checkUpdates() {
    try {
        const res = await pool.query(`
            SELECT school_id, 
                   MAX(daily_energy_kwh) as max_kwh, 
                   MAX(timestamp) as latest_ts 
            FROM public.telemetry 
            GROUP BY school_id
        `);
        console.log('--- Telemetry Snapshot ---');
        res.rows.forEach(row => {
            console.log(`School ${row.school_id}: ${row.max_kwh} kWh @ ${row.latest_ts}`);
        });
    } catch (e) {
        console.error(e);
    }
}

setInterval(checkUpdates, 2000);
console.log('Monitoring DB...');
