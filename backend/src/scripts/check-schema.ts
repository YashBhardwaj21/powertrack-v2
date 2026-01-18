import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const results: any = {};

        console.log('--- Collecting schema data ---');
        const res = await client.query(`
            SELECT table_schema, table_name 
            FROM information_schema.tables 
            WHERE table_name = 'schools'
        `);
        results.schools_tables = res.rows;

        const columns = await client.query(`
            SELECT table_schema, column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'schools'
            ORDER BY table_schema, ordinal_position
        `);
        results.schools_columns = columns.rows;

        const userCols = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'users' AND table_schema = 'public'
        `);
        results.users_columns = userCols.rows;

        const users = await client.query(`SELECT id, email, role, school_id FROM public.users`);
        results.users = users.rows;

        const views = await client.query("SELECT table_name FROM information_schema.views WHERE table_schema = 'public'");
        console.log('Views found:', views.rows.map(r => r.table_name));
        const deviceProfiles = await client.query(`SELECT * FROM public.device_profiles`);
        results.device_profiles = deviceProfiles.rows;

        const fs = await import('fs');
        fs.writeFileSync('schema-results.json', JSON.stringify(results, null, 2));
        console.log('✅ Results written to schema-results.json');

    } catch (err: any) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

checkSchema();
