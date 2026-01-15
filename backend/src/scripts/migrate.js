import pg from "pg";
import { readFileSync } from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const { Client } = pg;

const runMigration = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log("✅ Connected via Supabase Session Pooler");

        // 🔥 FORCE SCHEMA
        await client.query(`SET search_path TO public`);
        console.log("📌 search_path set to public");

        const schemaPath = path.join(__dirname, "../db/schema.sql");
        console.log("📄 Using schema:", schemaPath);

        const schema = readFileSync(schemaPath, "utf8");

        if (!schema.trim()) {
            throw new Error("schema.sql is empty");
        }

        await client.query(schema);

        console.log("✅ Migration completed successfully");
        await client.end();
        process.exit(0);
    } catch (err) {
        console.error("❌ Migration failed:", err);
        process.exit(1);
    }
};

runMigration();
