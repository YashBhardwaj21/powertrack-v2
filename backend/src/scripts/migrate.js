import pg from 'pg';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const { Client } = pg;

const runMigration = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Read schema file
        const schemaPath = join(__dirname, '../schema.sql');
        const schema = readFileSync(schemaPath, 'utf-8');

        // Execute schema
        await client.query(schema);
        console.log('✅ Database schema created successfully');

        await client.end();
        console.log('✅ Migration completed');
        process.exit(0);
    } catch (error) {
        console.error('❌ Migration failed:', error);
        await client.end();
        process.exit(1);
    }
};

runMigration();
