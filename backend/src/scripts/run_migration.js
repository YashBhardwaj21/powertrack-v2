
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicit DB URL
const connectionString = 'postgresql://postgres.cqdrjhugitgxbeybboee:Ybsaturnkt1607@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        const migrationPath = path.join(__dirname, '../db/migrations/003_add_export_columns.sql');
        console.log(`Reading migration from: ${migrationPath}`);
        const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

        await client.query(migrationSql);

        console.log('✅ Successfully added daily_export_kwh and daily_import_kwh columns');

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration Error:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
