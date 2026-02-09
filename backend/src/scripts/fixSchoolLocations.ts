/**
 * Fix Existing Schools - Apply correct timezone and coordinates from district
 * 
 * Run with: node dist/scripts/fixSchoolLocations.js
 */

import 'dotenv/config';
import { Pool } from 'pg';
import { getDistrictInfo } from '../utils/districtHelper.js';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

async function fixSchoolLocations() {
    console.log('🔧 Fixing school locations based on district...\n');

    const result = await pool.query(`
        SELECT id, name, district, timezone, latitude, longitude 
        FROM schools 
        WHERE deleted_at IS NULL
    `);

    for (const school of result.rows) {
        const districtInfo = getDistrictInfo(school.district);

        console.log(`📍 ${school.name}`);
        console.log(`   District: "${school.district}"`);
        console.log(`   Current:  tz=${school.timezone}, lat=${school.latitude}, lng=${school.longitude}`);
        console.log(`   Fixed:    tz=${districtInfo.timezone}, lat=${districtInfo.latitude}, lng=${districtInfo.longitude}`);

        // Check if any change is needed
        const tzChanged = school.timezone !== districtInfo.timezone;
        const latChanged = Math.abs(Number(school.latitude) - districtInfo.latitude) > 0.01;
        const lngChanged = Math.abs(Number(school.longitude) - districtInfo.longitude) > 0.01;

        if (tzChanged || latChanged || lngChanged) {
            await pool.query(`
                UPDATE schools 
                SET timezone = $1, latitude = $2, longitude = $3
                WHERE id = $4
            `, [districtInfo.timezone, districtInfo.latitude, districtInfo.longitude, school.id]);
            console.log(`   ✅ UPDATED\n`);
        } else {
            console.log(`   ⏭️  No change needed\n`);
        }
    }

    console.log('✅ Done fixing school locations!');
    await pool.end();
}

fixSchoolLocations().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
