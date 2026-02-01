import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '.env') });

const { Client } = pg;

const createAdmin = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        const passwordHash = await bcrypt.hash('admin123', 10);

        await client.query(`
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES ($1, $2, 'Temp Admin', 'admin')
            ON CONFLICT (email) DO UPDATE 
            SET password_hash = $2
        `, ['temp_admin@powertrack.com', passwordHash]);

        console.log('✅ User temp_admin@powertrack.com created/updated');
        await client.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

createAdmin();
