import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { Client } = pg;

const nuke = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log("Connected to DB. Preparing to NUKE...");

        // 1. Drop Schema
        console.log(" Dropping public schema...");
        await client.query("DROP SCHEMA IF EXISTS public CASCADE;");
        await client.query("CREATE SCHEMA public;");
        await client.query("GRANT ALL ON SCHEMA public TO public;"); // Standard default
        console.log("✅ Schema dropped and recreated.");

        // 2. Re-apply Schema.sql
        console.log(" Re-applying schema.sql...");
        const schemaPath = path.resolve(__dirname, "../db/schema.sql");
        const schemaSql = readFileSync(schemaPath, "utf-8");
        await client.query(schemaSql);
        console.log(" Base schema applied.");

        // 3. Re-apply Migrations keys (009, 010 etc)
        // We generally want to apply all migrations in order
        console.log("🔄 Applying migrations...");
        const migrationsDir = path.resolve(__dirname, "../db/migrations");
        const files = readdirSync(migrationsDir).sort(); // simple string sort usually works for 001, 002...

        for (const file of files) {
            if (file.endsWith(".sql")) {
                console.log(`   Running ${file}...`);
                const migrationSql = readFileSync(path.join(migrationsDir, file), "utf-8");
                try {
                    await client.query(migrationSql);
                } catch (e) {
                    console.warn(`   ⚠️ Warning in ${file}: ${e.message.split('\n')[0]}`);
                    // Continue, because schema.sql might already have the changes
                }
            }
        }
        console.log(" Migrations applied.");
        console.log(" Database successfully reset!");

    } catch (err) {
        console.error(" Error nuking database:", err);
        process.exit(1);
    } finally {
        await client.end();
        process.exit(0);
    }
};

nuke();
