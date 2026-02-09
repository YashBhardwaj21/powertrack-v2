
import { pool } from '../db/index.js';

async function monitorTest5() {
    console.log('Monitoring Test 5...');
    while (true) {
        const res = await pool.query(`
            SELECT timestamp, ac_power_kw, daily_energy_kwh 
            FROM telemetry 
            WHERE school_id = (SELECT id FROM schools WHERE name = 'Test5') 
            ORDER BY timestamp DESC LIMIT 1
        `);
        if (res.rows.length) {
            const row = res.rows[0];
            console.log(`${new Date().toISOString()} | Power: ${row.ac_power_kw} kW | Energy: ${row.daily_energy_kwh} kWh`);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
}

monitorTest5();
