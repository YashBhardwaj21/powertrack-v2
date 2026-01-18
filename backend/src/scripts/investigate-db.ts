import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkSchools() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
    });

    try {
        await client.connect();

        console.log('--- Phase 1: Verify schools table content ---');
        const res1 = await client.query(`
            SELECT id, name, api_key, api_key_hashed, created_at
            FROM public.schools
            ORDER BY created_at DESC;
        `);
        console.log(JSON.stringify(res1.rows, null, 2));

        console.log('\n--- Phase 1.2: Search API key with LIKE ---');
        const res2 = await client.query(`
            SELECT id, name, api_key, api_key_hashed
            FROM public.schools
            WHERE api_key LIKE '%pt_live%' OR api_key_hashed LIKE '%pt_live%';
        `);
        console.log(JSON.stringify(res2.rows, null, 2));

        console.log('\n--- Phase 1.3: Check for hidden whitespace ---');
        const res3 = await client.query(`
            SELECT id, name, api_key, LENGTH(api_key) AS key_length,
                   api_key_hashed, LENGTH(api_key_hashed) AS hashed_length
            FROM public.schools
            WHERE api_key IS NOT NULL OR api_key_hashed IS NOT NULL;
        `);
        console.log(JSON.stringify(res3.rows, null, 2));

        console.log('\n--- Phase 2.6: Confirm schema is public ---');
        const res4 = await client.query(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_name = 'schools';
        `);
        console.log(JSON.stringify(res4.rows, null, 2));

    } catch (err) {
        console.error('Error executing query', err);
    } finally {
        await client.end();
    }
}

checkSchools();
