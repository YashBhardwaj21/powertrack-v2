
import { pool } from '../db/index.js';

async function resetData() {
    console.log('🧨 STARTING FACTORY RESET (Runtime Data Only)...');

    try {
        // 1. Telemetry (The big one)
        console.log('   - Truncating telemetry...');
        await pool.query('TRUNCATE TABLE telemetry RESTART IDENTITY CASCADE');

        // 2. Alerts
        console.log('   - Truncating alerts...');
        await pool.query('TRUNCATE TABLE alerts RESTART IDENTITY CASCADE');

        // 3. Simulator Checkpoint (The state)
        console.log('   - Truncating simulator_checkpoint...');
        await pool.query('TRUNCATE TABLE simulator_checkpoint RESTART IDENTITY CASCADE');

        // Note: We DO NOT touch 'schools' or 'users'.

        console.log('\n✅ SIMULATION DATA WIPED.');
        console.log('   When you restart the server, the simulator will start from ZERO (Day 1).');
    } catch (err) {
        console.error('❌ Reset failed:', err);
    } finally {
        process.exit(0);
    }
}

resetData();
