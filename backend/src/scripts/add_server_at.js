import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();

const { Client } = pg;

const migrate = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log("✅ Connected to DB");

        // Add column safely
        await client.query(`
            ALTER TABLE public.telemetry 
            ADD COLUMN IF NOT EXISTS server_at TIMESTAMPTZ DEFAULT NOW();
        `);
        console.log("✅ Added 'server_at' column to telemetry table");

        await client.end();
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
};

migrate();
