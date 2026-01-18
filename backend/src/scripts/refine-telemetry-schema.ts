import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('🚀 Starting Telemetry Schema Refinement...');

        // 1. Add missing metrics and flags
        await client.query(`
            ALTER TABLE public.telemetry 
            ADD COLUMN IF NOT EXISTS load_kw NUMERIC(12,3),
            ADD COLUMN IF NOT EXISTS grid_export_kw NUMERIC(12,3),
            ADD COLUMN IF NOT EXISTS grid_import_kw NUMERIC(12,3),
            ADD COLUMN IF NOT EXISTS is_backfill BOOLEAN DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS is_suspect_time BOOLEAN DEFAULT FALSE;
        `);
        console.log('✅ Added metrics and flag columns');

        // 2. Ensure device_profile_id is NOT NULL in schools
        // First check if there are any schools without a device_profile_id
        const orphanSchools = await client.query(`SELECT id FROM public.schools WHERE device_profile_id IS NULL`);
        if (orphanSchools.rowCount > 0) {
            console.log(`⚠️ Found ${orphanSchools.rowCount} schools without device profiles. Linking to first available profile...`);
            const firstProfile = await client.query(`SELECT id FROM public.device_profiles LIMIT 1`);
            if (firstProfile.rowCount > 0) {
                await client.query(`UPDATE public.schools SET device_profile_id = $1 WHERE device_profile_id IS NULL`, [firstProfile.rows[0].id]);
                console.log('✅ Linked orphan schools to default profile');
            } else {
                console.log('❌ No device profiles found. Cannot enforce NOT NULL constraint yet.');
            }
        }

        console.log('🏁 Schema refinement complete!');
    } catch (err: any) {
        console.error('❌ Migration Failure:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
