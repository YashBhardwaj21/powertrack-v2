import pg from "pg";
import { readFileSync, readdirSync } from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { Client } = pg;

const recover = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        console.log("🚑 Connected to DB. Starting Safe Recovery...");

        // 1. Ensure Public Schema Exists
        console.log("🔧 Ensuring 'public' schema exists...");
        await client.query("CREATE SCHEMA IF NOT EXISTS public;");
        await client.query("GRANT ALL ON SCHEMA public TO public;");
        console.log("✅ Schema check passed.");

        // 2. Apply Schema (Safe: IF NOT EXISTS)
        console.log("🏗️ Applying schema.sql (Safely)...");
        const schemaPath = path.resolve(__dirname, "../db/schema.sql");
        const schemaSql = readFileSync(schemaPath, "utf-8");
        await client.query(schemaSql);
        console.log("✅ Base schema ensured (including Users table).");

        // 3. Apply Migrations (Safe: They should be idempotent or IF NOT EXISTS)
        console.log("🔄 Applying migrations...");
        const migrationsDir = path.resolve(__dirname, "../db/migrations");

        if (checkDirExists(migrationsDir)) {
            const files = readdirSync(migrationsDir).sort();
            for (const file of files) {
                if (file.endsWith(".sql")) {
                    console.log(`   Checking ${file}...`);
                    const migrationSql = readFileSync(path.join(migrationsDir, file), "utf-8");
                    try {
                        await client.query(migrationSql);
                    } catch (e) {
                        // Warn but don't fail, as some might duplicate
                        console.warn(`   ⚠️ Note for ${file}: ${e.message.split('\n')[0]}`);
                    }
                }
            }
        }

        console.log("🚀 Database recovered successfully!");

    } catch (err) {
        console.error("❌ Recovery failed:", err);
        process.exit(1);
    } finally {
        await client.end();
    }
};

function checkDirExists(dir) {
    try {
        readdirSync(dir);
        return true;
    } catch {
        return false;
    }
}

recover();
