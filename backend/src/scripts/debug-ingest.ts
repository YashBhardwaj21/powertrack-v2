
import { pool } from '../db/index.js';
import crypto from 'crypto';

const apiKey = "pt_live_4f9310a5799451d9fdd63ed53577913979c1489672f3cbc49dd4e6c8f663b490";

const run = async () => {
    try {
        console.log('1. Hashing API Key...');
        const hash = crypto.createHash('sha256').update(apiKey).digest('hex');
        console.log('   Hash:', hash);

        console.log('2. Finding School...');
        const schoolRes = await pool.query('SELECT id, name FROM public.schools WHERE api_key_hash = $1', [hash]);
        if (schoolRes.rows.length === 0) {
            console.error('❌ School not found for this API Key.');
            process.exit(1);
        }
        const schoolId = schoolRes.rows[0].id;
        console.log(`   Found School: ${schoolRes.rows[0].name} (${schoolId})`);

        console.log('3. Attempting INSERT...');
        const nowSeconds = Math.floor(Date.now() / 1000); // Current Time

        // Simulating the values from the request
        const queryText = `
            INSERT INTO public.telemetry (
                school_id,
                timestamp,
                ac_power_kw,
                ac_voltage,
                ac_current,
                daily_energy_kwh,
                total_energy_kwh,
                panel_temp_c,
                irradiance_wm2,
                efficiency_percent,
                load_kw,
                grid_export_kw,
                grid_import_kw,
                weather_condition,
                fault,
                quality_score,
                is_backfill,
                is_suspect_time
            ) VALUES (
                $1, 
                COALESCE(to_timestamp($2::numeric), NOW()),
                $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
            )
            RETURNING *
        `;

        const values = [
            schoolId,
            nowSeconds,
            2.45,   // ac_power_kw (2450 / 1000)
            228,    // voltage
            10.7,   // current
            12.4,   // daily
            1543.2, // total
            42.1,   // temp
            860,    // irradiance
            null,   // efficiency (skip calc for now)
            1.8,    // load
            1.2,    // export
            0.6,    // import
            'sunny',
            'comm_down', // suspect time -> comm_down
            1.0,
            false,  // is_backfill
            false   // is_suspect_time
        ];

        await pool.query(queryText, values);
        console.log('✅ INSERT Successful!');

    } catch (error: any) {
        console.error('\n❌ INSERT FAILED with Error:');
        console.error('   Message:', error.message);
        console.error('   Code:', error.code);
        console.error('   Detail:', error.detail);
        console.error('   Hint:', error.hint);
        console.error('--------------------------------------------------');
        console.error('Full Error Object:', error);
    } finally {
        await pool.end();
    }
};

run();
