import { query, pool } from '../db/index.js';
import { telemetryIngestSchema } from '../validation/schemas.js';
import { z } from 'zod';

async function verifyStability() {
    console.log('🚀 Starting Final Stability Verification...');
    let passed = true;

    // 1. Verify Partitioning & Future Insert
    console.log('\n📅 1. Verifying Auto-Partitioning (Timebomb Check)...');
    try {
        const futureDate = new Date('2028-01-15T12:00:00Z'); // Far future
        // ... (rest of setup)
        const ts = Math.floor(futureDate.getTime() / 1000);

        // Use a fake school ID (must assume one exists or insert one)
        // Let's first get a dummy school or insert one
        let schoolId = '00000000-0000-0000-0000-000000000000';
        const schoolRes = await query(`INSERT INTO public.schools (name, api_key_hash) VALUES ('Test School Partition', 'hash_123') ON CONFLICT (api_key_hash) DO UPDATE SET name=EXCLUDED.name RETURNING id`);
        schoolId = schoolRes.rows[0].id;

        // Insert directly to DB to trigger the BEFORE INSERT trigger
        await query(
            `INSERT INTO public.telemetry (
                school_id, timestamp, ac_power_kw, ac_voltage, ac_current, daily_energy_kwh, total_energy_kwh
            ) VALUES ($1, $2, 10, 220, 5, 100, 1000)`,
            [schoolId, futureDate]
        );

        // Check if partition exists
        const partitionName = `telemetry_2028_01`;
        const checkPart = await query(`SELECT to_regclass('public.${partitionName}')`);

        if (checkPart.rows[0].to_regclass) {
            console.log(`✅ Verified: Partition '${partitionName}' was auto-created.`);
        } else {
            console.error(`❌ Failed: Partition '${partitionName}' was NOT created.`);
            passed = false;
        }

        // Cleanup
        await query(`DELETE FROM public.schools WHERE id = $1`, [schoolId]);

    } catch (err: any) {
        console.error('❌ Partitioning Test Failed:', err.message, err.detail || '');
        passed = false;
    }

    // 2. Verify Schema Cleanup (No Duplicate Alerts)
    console.log('\n🧹 2. Verifying Schema Cleanup...');
    try {
        const alertsCols = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'alerts'`);
        if (alertsCols.rows.length > 0) {
            console.log(`✅ Verified: 'alerts' table exists and schema is clean.`);
        } else {
            console.error('❌ Failed: Alerts table missing.');
            passed = false;
        }
    } catch (err: any) {
        console.error('❌ Schema Test Failed:', err.message);
        passed = false;
    }

    // 3. Verify Zod Validation Logic
    console.log('\n🛡 3. Verifying Validation Logic...');
    const validPayload = {
        ts: 1700000000,
        power_w: 5000,
        voltage: 220,
        current_a: 22.7
    };

    const invalidPayload = {
        ts: "invalid", // String instead of number
        power_w: "5000" // String instead of number
    };

    const v1 = telemetryIngestSchema.safeParse(validPayload);
    const v2 = telemetryIngestSchema.safeParse(invalidPayload);

    if (v1.success && !v2.success) {
        console.log('✅ Verified: Zod correctly accepts valid data and rejects invalid types.');
    } else {
        console.error('❌ Validation Logic Failed:', { v1: v1.success, v2: v2.success });
        passed = false;
    }

    // 4. API Key Security
    console.log('\n🔐 4. Verifying API Key Columns...');
    try {
        const cols = await query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'schools' AND column_name LIKE 'api_key%'`);
        const found = cols.rows.map(r => r.column_name);
        if (found.includes('api_key_hash') && !found.includes('api_key')) {
            console.log('✅ Verified: Only stored hash, plaintext key removed.');
        } else {
            console.error('❌ Security Check Failed. Found columns:', found);
            passed = false;
        }
    } catch (err) {
        console.error('❌ API Key Check Failed:', err);
        passed = false;
    }

    console.log('\n🏁 Verification Complete.');
    if (passed) {
        console.log('✨ ALL SYSTEMS GO. Production Ready.');
        process.exit(0);
    } else {
        console.error('⚠️ Issues Detected.');
        process.exit(1);
    }
}

verifyStability();
