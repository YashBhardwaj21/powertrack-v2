import pg from "pg";
import { readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (backend/)
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const { Client } = pg;

const runHardening = async () => {
    if (!process.env.DATABASE_URL) {
        console.error("❌ DATABASE_URL is missing. Checking .env at:", envPath);
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }, // Required for Supabase transaction pooler
    });

    try {
        await client.connect();
        console.log("✅ Connected to database");

        // Force public schema
        await client.query(`SET search_path TO public`);

        const migrationPath = path.join(__dirname, "../db/migrations/009_schema_hardening.sql");
        console.log("📄 Applying migration:", migrationPath);

        const sql = readFileSync(migrationPath, "utf8");

        if (!sql.trim()) {
            throw new Error("Migration file is empty");
        }

        await client.query(sql);

        console.log("✅ Schema Hardening Applied Successfully");
        console.log("   - Constraints added");
        console.log("   - Precision updated");
        console.log("   - Local Date & Indexes added");
        console.log("   - Partition trigger removed & partitions created");

        await client.end();
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
};

runHardening();
