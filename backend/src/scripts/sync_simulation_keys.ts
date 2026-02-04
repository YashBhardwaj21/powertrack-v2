import { query, pool } from '../db/index.js';
import crypto from 'crypto';

// Keys extracted from the user's current simulate-solar.ps1
const SIMULATION_KEYS = [
    "pt_live_fcb220881cafd66665ddf79f72a16755ec225115a90e844f3d0402a24f45afef",
    "pt_live_c12a86a75a476da6d211b70c5045642b872165093de8dab9ebe652fdb7bcd6b5",
    "pt_live_49f6684c0c1b21ab79770c38d330e66a3a81f46cff867c918a6b9daba7dd5876",
    "pt_live_2b13ffd6fcfe5cc9a53a94d29e611a87efe6fe49ceb4bd90b8da1a414a511f9d"
];

async function syncKeys() {
    try {
        console.log('🔄 Syncing Database with Simulation Script Keys...');

        // Fetch schools
        const schools = await query('SELECT id, name FROM public.schools ORDER BY created_at ASC');

        if (schools.rows.length === 0) {
            console.error('❌ No schools found! Create 4 schools first.');
            process.exit(1);
        }

        if (schools.rows.length < 4) {
            console.warn(`⚠️ Warning: Only found ${schools.rows.length} schools, but have 4 keys. Some keys won't be used.`);
        }

        for (let i = 0; i < schools.rows.length; i++) {
            const school = schools.rows[i];
            if (i >= SIMULATION_KEYS.length) break;

            const rawKey = SIMULATION_KEYS[i];
            const hash = crypto.createHash('sha256').update(rawKey).digest('hex');

            await query('UPDATE public.schools SET api_key_hash = $1 WHERE id = $2', [hash, school.id]);

            console.log(`✅ Linked School "${school.name}" <--> Key starting with ...${rawKey.substring(8, 16)}`);
        }

        console.log('\n✨ Database is now synchronized with your simulation script.');
        await pool.end();
    } catch (err) {
        console.error(err);
    }
}

syncKeys();
