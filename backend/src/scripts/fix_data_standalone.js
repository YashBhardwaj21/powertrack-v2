import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    try {
        console.log("🔌 Connecting to DB...");
        const client = await pool.connect();

        console.log("🛠️ Fixing Timezones...");
        const updateRes = await client.query(`
            UPDATE public.schools 
            SET timezone = 'Asia/Jakarta' 
            WHERE timezone IS NULL
            RETURNING id, name, timezone
        `);
        console.log(`✅ Updated ${updateRes.rowCount} schools to Asia/Jakarta.`);
        if (updateRes.rowCount > 0) console.table(updateRes.rows);

        console.log("🔍 Checking Latest Telemetry...");
        const telemetryRes = await client.query(`
            SELECT timestamp, school_id 
            FROM public.telemetry 
            ORDER BY timestamp DESC 
            LIMIT 5
        `);
        console.table(telemetryRes.rows);

        // Check age
        if (telemetryRes.rows.length > 0) {
            const latest = new Date(telemetryRes.rows[0].timestamp);
            const now = new Date();
            const diffHours = (now - latest) / (1000 * 60 * 60);
            console.log(`⏱️ Latest data is ${diffHours.toFixed(2)} hours old.`);
        } else {
            console.log("⚠️ No telemetry data found.");
        }

        client.release();
    } catch (err) {
        console.error("❌ Error:", err);
    } finally {
        await pool.end();
    }
}

run();
