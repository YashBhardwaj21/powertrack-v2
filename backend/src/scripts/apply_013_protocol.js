
import pg from "pg";
import { readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { Client } = pg;

const applyMigration = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log("✅ Connected to DB");

        const migrationPath = path.resolve(__dirname, "../db/migrations/013_add_school_protocol.sql");
        const sql = readFileSync(migrationPath, "utf-8");

        console.log("Applying 013_add_school_protocol.sql...");
        await client.query(sql);
        console.log("✅ Migration 013 applied successfully.");

    } catch (err) {
        console.error("❌ Error applying migration 013:", err);
        process.exit(1);
    } finally {
        await client.end();
    }
};

applyMigration();
