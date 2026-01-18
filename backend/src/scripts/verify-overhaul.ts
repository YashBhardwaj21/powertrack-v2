import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function verify() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        console.log('--- Verification: Schools Table Schema ---');
        const schemaInfo = await client.query(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'schools' AND table_schema = 'public'
            ORDER BY column_name;
        `);
        console.table(schemaInfo.rows);

        console.log('\n--- Verification: Active Schools View ---');
        const activeSchools = await client.query('SELECT COUNT(*) FROM public.schools WHERE deleted_at IS NULL');
        console.log(`Active schools count: ${activeSchools.rows[0].count}`);

        console.log('\n--- Verification: Device Profiles Schema ---');
        const profileInfo = await client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'device_profiles' AND table_schema = 'public'
            AND column_name = 'version';
        `);
        console.table(profileInfo.rows);

        console.log('\n--- Verification: Sample Schools API Hash Length ---');
        const sampleHashes = await client.query(`
            SELECT id, name, LENGTH(api_key_hash) as hash_len 
            FROM public.schools 
            LIMIT 3;
        `);
        console.table(sampleHashes.rows);

    } catch (err) {
        console.error('Verification failed:', err);
    } finally {
        await client.end();
    }
}

verify();
