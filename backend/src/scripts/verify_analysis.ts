
import { pool } from '../db/index.js';

async function diagnose() {
    console.log('🔍 Running User Analysis Verification...\n');

    // 1. Check Capacities (Issue #5)
    console.log('--- Capacities (Issue #5) ---');
    const capRes = await pool.query('SELECT name, total_capacity_kwp FROM schools ORDER BY total_capacity_kwp DESC');
    console.table(capRes.rows);

    // 2. Check Monotonic Violations (Issue #1 / Step 2)
    console.log('\n--- Monotonicity Check (Issue #1) ---');
    // Look for any row where the NEXT row (by time) has LOWER daily_energy
    // Limit to today to be relevant
    const monoRes = await pool.query(`
        WITH ordered_t AS (
            SELECT school_id, timestamp, daily_energy_kwh,
                   LEAD(daily_energy_kwh) OVER (PARTITION BY school_id ORDER BY timestamp) as next_val,
                   LEAD(timestamp) OVER (PARTITION BY school_id ORDER BY timestamp) as next_time
            FROM telemetry
            WHERE timestamp > NOW() - INTERVAL '1 hour'
        )
        SELECT school_id, timestamp, daily_energy_kwh, next_val, next_time
        FROM ordered_t
        WHERE next_val < daily_energy_kwh
        AND DATE(timestamp) = DATE(next_time) -- Ignore midnight resets
        LIMIT 5;
    `);

    if (monoRes.rows.length > 0) {
        console.log('❌ VIOLATION FOUND: Energy decreased!');
        console.table(monoRes.rows.map(r => ({
            school: r.school_id,
            time: r.timestamp.toISOString().split('T')[1],
            val: r.daily_energy_kwh,
            next: r.next_val,
            diff: (r.next_val - r.daily_energy_kwh).toFixed(4)
        })));
    } else {
        console.log('✅ No monotonic violations in last hour.');
    }

    // 3. Check TEST5 Raw Data (Step 1)
    console.log('\n--- TEST5 Recent Telemetry (Step 1) ---');
    // Find ID for TEST5 first (or just likeliest candidate)
    const test5 = capRes.rows.find(r => r.name === 'TEST5') || capRes.rows[0];
    if (test5) {
        const rawRes = await pool.query(`
            SELECT timestamp, ac_power_kw, daily_energy_kwh
            FROM telemetry
            WHERE school_id = (SELECT id FROM schools WHERE name = $1)
            ORDER BY timestamp DESC
            LIMIT 5
        `, [test5.name]);
        console.table(rawRes.rows.map(r => ({
            time: r.timestamp.toISOString().split('T')[1],
            pwr: r.ac_power_kw,
            energy: r.daily_energy_kwh
        })));

        // 4. Math Check (Step 4)
        console.log('\n--- Math Check (Step 4) ---');
        const mathRes = await pool.query(`
             SELECT 
                MAX(daily_energy_kwh) AS reported_daily,
                AVG(ac_power_kw) AS avg_power,
                (EXTRACT(EPOCH FROM (MAX(timestamp) - MIN(timestamp))) / 3600) as hours_elapsed
            FROM telemetry
            WHERE school_id = (SELECT id FROM schools WHERE name = $1)
            AND timestamp > DATE_TRUNC('day', NOW())
        `, [test5.name]);

        const m = mathRes.rows[0];
        const calculated = m.avg_power * m.hours_elapsed;
        console.log(`Reported Daily: ${m.reported_daily}`);
        console.log(`Calculated (Avg * Hours): ${calculated.toFixed(4)}`);
        console.log(`Difference: ${Math.abs(m.reported_daily - calculated).toFixed(4)}`);
    }

    process.exit(0);
}

diagnose().catch(console.error);
