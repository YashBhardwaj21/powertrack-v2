import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from project root (backend/)
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const OUTPUT_FILE = path.join(__dirname, "../../audit_output.txt");
fs.writeFileSync(OUTPUT_FILE, ""); // Clear file

function log(msg) {
    console.log(msg);
    if (typeof msg === 'object') {
        fs.appendFileSync(OUTPUT_FILE, JSON.stringify(msg, null, 2) + "\n");
    } else {
        fs.appendFileSync(OUTPUT_FILE, msg + "\n");
    }
}

const { Client } = pg;

const runAudit = async () => {
    if (!process.env.DATABASE_URL) {
        log("❌ DATABASE_URL is missing.");
        process.exit(1);
    }

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();
        log("✅ Connected to DB");

        log("\n--- 1. SYSTEM INFO ---");
        const ver = await client.query("SELECT version()");
        log("DB Version: " + ver.rows[0].version);
        const time = await client.query("SELECT NOW() as db_time, current_setting('TIMEZONE') as db_tz");
        log("DB Time: " + time.rows[0].db_time);
        log("DB Timezone: " + time.rows[0].db_tz);

        log("\n--- 2. SCHOOLS OVERVIEW ---");
        const schools = await client.query("SELECT id, name, timezone, total_capacity_kwp FROM schools ORDER BY id LIMIT 3");
        log(schools.rows);

        log("\n--- 3. TELEMETRY AUDIT (Last 500 rows per school) ---");
        for (const school of schools.rows) {
            log(`\nChecking School: ${school.name} (${school.timezone})`);

            const tele = await client.query(`
                SELECT timestamp, total_energy_kwh, daily_energy_kwh, local_date 
                FROM telemetry 
                WHERE school_id = $1 
                ORDER BY timestamp DESC 
                LIMIT 500
            `, [school.id]);

            if (tele.rows.length === 0) {
                log("  ⚠️ No Data");
                continue;
            }

            const rows = tele.rows; // Newest first
            log(`  Fetched ${rows.length} rows. Range: ${rows[rows.length - 1].timestamp.toISOString()} -> ${rows[0].timestamp.toISOString()}`);

            // Checks
            let decreasedCount = 0;
            let duplicates = 0;
            let maxTotal = -1;
            let lastTs = null;

            // Iterate oldest to newest
            for (let i = rows.length - 1; i >= 0; i--) {
                const row = rows[i];
                const currentTotal = parseFloat(row.total_energy_kwh);

                // Init
                if (maxTotal === -1) maxTotal = currentTotal;

                // Check monotonicity
                if (currentTotal < maxTotal) {
                    decreasedCount++;
                    // Only log first few
                    if (decreasedCount <= 3) {
                        log(`  🔴 DROP DETECTED at ${row.timestamp}: ${currentTotal} < ${maxTotal}`);
                    }
                } else {
                    maxTotal = currentTotal;
                }

                // Check duplicates (approx)
                if (lastTs && new Date(row.timestamp).getTime() === new Date(lastTs).getTime()) {
                    duplicates++;
                }
                lastTs = row.timestamp;
            }

            if (decreasedCount > 0) log(`  ❌ Non-monotonic events: ${decreasedCount}`);
            else log("  ✅ Monotonicity (Total Energy) OK");

            if (duplicates > 0) log(`  ❌ Duplicate timestamps: ${duplicates}`);
            else log("  ✅ No Duplicates OK");

            // Local Date check
            const latest = rows[0];
            if (latest.local_date) {
                // Approximate check
                // Force cast to string for verify
                const tsDate = new Date(latest.timestamp).toLocaleDateString('en-CA', { timeZone: school.timezone });
                log(`  🔍 Local Date Check: TS=${new Date(latest.timestamp).toISOString()} (${school.timezone}) -> Expected=${tsDate}, Stored=${latest.local_date}`);
            } else {
                log("  ⚠️ local_date is NULL (old data?)");
            }
        }

        log("\n--- 4. PARTITION & STORAGE ---");
        const partitions = await client.query(`
            SELECT 
                parent.relname AS parent,
                child.relname AS child,
                pg_size_pretty(pg_relation_size(child.oid)) AS size
            FROM pg_inherits
            JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
            JOIN pg_class child ON pg_inherits.inhrelid = child.oid
            WHERE parent.relname = 'telemetry'
            ORDER BY child.relname DESC
            LIMIT 10;
        `);
        log(partitions.rows);

        log("\n--- 5. DAILY AGGREGATION CHECK (Last 5 entries) ---");
        const daily = await client.query(`
            SELECT school_id, day, daily_energy_kwh, updated_at 
            FROM telemetry_daily 
            ORDER BY day DESC, school_id 
            LIMIT 10
        `);
        log(daily.rows);

        await client.end();

    } catch (err) {
        log(err.toString());
        process.exit(1);
    }
};

runAudit();
