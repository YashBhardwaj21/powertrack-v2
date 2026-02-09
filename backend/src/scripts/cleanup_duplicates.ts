
import { pool } from '../db/index.js';

async function cleanup() {
    console.log('🧹 Cleaning up duplicate telemetry rows (Keeping Highest Value)...');

    // DELETE rows where a row with the SAME timestamp but HIGHER energy exists
    const res = await pool.query(`
        DELETE FROM telemetry t1
        WHERE EXISTS (
            SELECT 1 FROM telemetry t2
            WHERE t2.school_id = t1.school_id
            AND t2.timestamp = t1.timestamp
            AND t2.total_energy_kwh > t1.total_energy_kwh
        );
    `);

    console.log(`✅ Deleted ${res.rowCount} duplicate rows.`);
    console.log('✨ Data should now be stable. Please refresh your dashboard.');
    process.exit(0);
}

cleanup().catch(console.error);
