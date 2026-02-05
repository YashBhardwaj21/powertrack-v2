
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicit DB URL
const connectionString = 'postgresql://postgres.cqdrjhugitgxbeybboee:Ybsaturnkt1607@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        const migrationPath = path.join(__dirname, '../db/migrations/004_telemetry_daily.sql');
        console.log(`Reading migration from: ${migrationPath}`);
        const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

        await client.query(migrationSql);
        console.log('✅ Successfully created telemetry_daily table and aggregation procedure');

        // Initial Backfill for the current month so far
        console.log('🔄 Running initial backfill for current month...');
        await client.query(`
            INSERT INTO public.telemetry_daily (
                school_id, day, 
                daily_energy_kwh, daily_export_kwh, daily_import_kwh,
                peak_power_kw, avg_temp_c, avg_irradiance_wm2
            )
            SELECT 
                school_id,
                DATE(timestamp AT TIME ZONE 'Asia/Jakarta') as day,
                MAX(daily_energy_kwh) as daily_energy_kwh,
                MAX(daily_export_kwh) as daily_export_kwh,
                MAX(daily_import_kwh) as daily_import_kwh,
                MAX(ac_power_kw) as peak_power_kw,
                AVG(panel_temp_c) as avg_temp_c,
                AVG(irradiance_wm2) as avg_irradiance_wm2
            FROM public.telemetry
            GROUP BY school_id, day
            ON CONFLICT (school_id, day) DO NOTHING;
        `);
        console.log('✅ Backfill complete');

        process.exit(0);
    } catch (err) {
        console.error('❌ Migration Error:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
