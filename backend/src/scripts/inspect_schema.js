import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const { Client } = pg;

const inspect = async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        const res = await client.query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'telemetry' 
            AND column_name = 'daily_load_kwh';
        `);
        console.log("Column Check Result:", res.rows);
        await client.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

inspect();
