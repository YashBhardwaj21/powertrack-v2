import { query, pool } from '../db/index.js';
import crypto from 'crypto';

const SCHOOLS = [
    { name: 'Sunnyvale Elementary', type: 'Elementary', district: 'North' },
    { name: 'Riverside High School', type: 'High School', district: 'East' },
    { name: 'Oak Grove Academy', type: 'Academy', district: 'South' },
    { name: 'Pine Valley School', type: 'Public', district: 'West' }
];

async function seedSimulationSchools() {
    try {
        console.log('\n🌱 Seeding Simulation Schools...\n');

        const newKeys: string[] = [];

        for (const school of SCHOOLS) {
            // Generate Key
            const rawKey = 'pt_live_' + crypto.randomBytes(32).toString('hex');
            const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

            // Create School
            const res = await query(`
        INSERT INTO public.schools (name, type, district, api_key_hash)
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `, [school.name, school.type, school.district, hash]);

            console.log(`✅ Created ${school.name}`);
            newKeys.push(`    "${rawKey}"`);
        }

        console.log('\n\n📋 COPY THESE KEYS TO YOUR simulate-solar.ps1 FILE:\n');
        console.log('$API_KEYS = @(');
        console.log(newKeys.join(',\n'));
        console.log(')\n');

        await pool.end();
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err);
        process.exit(1);
    }
}

seedSimulationSchools();
