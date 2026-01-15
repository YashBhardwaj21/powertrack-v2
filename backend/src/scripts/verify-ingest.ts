
import { query, pool } from '../db/index.js';
import crypto from 'crypto';

const verifyIngest = async () => {
    try {
        console.log('🧪 Starting ESP32 Ingestion Verification...');

        // 1. Create a test school with an API key
        const testApiKey = crypto.randomBytes(32).toString('hex');
        const testSchoolName = `Test School ${Date.now()}`;

        console.log(`📝 Creating test school: "${testSchoolName}" with API Key...`);

        const schoolResult = await query(
            `INSERT INTO public.schools (name, api_key, type, district)
             VALUES ($1, $2, 'Test', 'Test District')
             RETURNING id, api_key`,
            [testSchoolName, testApiKey]
        );

        const school = schoolResult.rows[0];
        console.log(`✅ School created. ID: ${school.id}`);
        console.log(`🔑 API Key: ${school.api_key}`);

        // 2. Mock ESP32 Payload
        const payload = {
            power_w: 5000,
            voltage: 220,
            current_a: 22.7,
            daily_kwh: 25.5,
            total_kwh: 1000.5,
            temp_c: 45.2,
            irradiance_wm2: 800,
            weather_condition: 'sunny'
        };

        console.log('📡 Sending telemetry payload:', payload);

        // 3. Send HTTP POST request
        const response = await fetch('http://localhost:3001/api/v1/telemetry/ingest', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-API-Key': testApiKey
            },
            body: JSON.stringify(payload)
        });

        const responseData = await response.json();

        if (response.status === 201) {
            console.log('✅ Ingestion Successful! Response:', responseData);
        } else {
            console.error(`❌ Ingestion Failed! Status: ${response.status}`, responseData);
            process.exit(1);
        }

        // 4. Verify in DB
        console.log('🔍 Verifying data in database...');
        const telemetryResult = await query(
            'SELECT * FROM public.telemetry WHERE school_id = $1 ORDER BY timestamp DESC LIMIT 1',
            [school.id]
        );

        if (telemetryResult.rows.length > 0) {
            const t = telemetryResult.rows[0];
            console.log('✅ Telemetry found in DB:', {
                id: t.id,
                ac_power_kw: t.ac_power_kw,
                school_id: t.school_id
            });

            // Cleanup
            console.log('🧹 Cleaning up test data...');
            await query('DELETE FROM public.schools WHERE id = $1', [school.id]);
            console.log('✅ Cleanup complete.');
        } else {
            console.error('❌ No telemetry found in DB for this school!');
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
};

verifyIngest();
