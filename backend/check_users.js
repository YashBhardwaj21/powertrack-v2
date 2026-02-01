import pg from 'pg';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const { Client } = pg;

const check = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/powertrack',
    });

    try {
        await client.connect();
        const res = await client.query('SELECT email, role, school_id FROM users');
        console.log('Users found:', res.rows);
        await client.end();
    } catch (err) {
        console.error(err);
    }
};

check();
