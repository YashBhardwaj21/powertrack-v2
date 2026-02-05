import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

dotenv.config();

const { Client } = pg;

const clearTelemetry = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log("✅ Connected to DB");

        // Truncate telemetry table (cascades to partitions, but safe for schools)
        await client.query('TRUNCATE TABLE public.telemetry');
        console.log("✅ Successfully cleared all telemetry data");

        await client.end();
    } catch (err) {
        console.error("❌ Failed to clear telemetry:", err);
        process.exit(1);
    }
};

clearTelemetry();
