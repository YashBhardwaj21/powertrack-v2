import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Hardcoded from simulator.ts
const SIMULATION_LOCK_ID = 424242;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const { Client } = pg;

const unlock = async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    try {
        await client.connect();
        const res = await client.query(`SELECT pg_advisory_unlock($1)`, [SIMULATION_LOCK_ID]);
        console.log(`🔓 Lock Release Result: ${res.rows[0].pg_advisory_unlock}`);
        await client.end();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

unlock();
