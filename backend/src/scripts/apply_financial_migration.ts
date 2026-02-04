
import { query, getClient } from '../db/index.js';

const runMigration = async () => {
    const client = await getClient();
    try {
        console.log("--- Applying Financial Migration ---");

        // 1. Add Columns to Telemetry
        await client.query(`
            ALTER TABLE public.telemetry 
            ADD COLUMN IF NOT EXISTS daily_export_kwh DECIMAL(10, 2) DEFAULT 0,
            ADD COLUMN IF NOT EXISTS daily_import_kwh DECIMAL(10, 2) DEFAULT 0;
        `);
        console.log("✅ Added columns to telemetry");

        // 2. Add Feed-in Tariff
        await client.query(`
            INSERT INTO public.system_parameters (key, value, unit, label)
            VALUES ('feed_in_tariff_idr', 500, 'IDR/kWh', 'Solar Feed-in Tariff')
            ON CONFLICT (key) DO NOTHING;
        `);
        console.log("✅ Added feed_in_tariff_idr");

    } catch (error) {
        console.error("❌ Migration Failed:", error);
    } finally {
        client.release();
    }
};

runMigration();
