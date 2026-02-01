
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv'; // Keep dotenv for explicit loading if needed, but config usually handles it

// Polyfill __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env explicitly to be safe
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
});

async function runMigration() {
    try {
        console.log('🔌 Connecting to database...');
        const client = await pool.connect();
        try {
            console.log('📄 Reading migration file...');
            const migrationPath = path.join(__dirname, '../db/migrations/add_timezone.sql');
            const sql = fs.readFileSync(migrationPath, 'utf8');

            console.log('🚀 Executing migration...');
            await client.query(sql);

            console.log('✅ Migration successful: Timezone column added.');
        } finally {
            client.release();
        }
    } catch (err) {
        console.error('❌ Migration failed:', err);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

runMigration();
