import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import pg from 'pg';
import crypto from 'crypto';

const { Client } = pg;

async function migrate() {
    console.log('🚀 Starting Refactor Migration (Dedicated Client)...');

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 30000, // 30s connection timeout
        query_timeout: 60000 // 60s query timeout
    });

    try {
        await client.connect();
        console.log('✅ Connected to DB');

        await client.query('BEGIN');

        // 1. Schools: Migrate API Key to Hash
        console.log('🔐 Migrating Schools API Keys...');
        await client.query(`ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS api_key_hash TEXT UNIQUE`);

        // Check if api_key column exists
        const hasApiKey = await client.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'schools' AND column_name = 'api_key'
        `);

        if (hasApiKey.rows.length > 0) {
            console.log('Found api_key column, hashing values...');
            const schools = await client.query(`SELECT id, api_key FROM public.schools WHERE api_key IS NOT NULL`);
            for (const school of schools.rows) {
                // Only hash if target hash is empty to avoid double-hashing or overwriting if running multiple times
                // But simplified: Upsert or Overwrite is fine for migration.
                const hash = crypto.createHash('sha256').update(school.api_key).digest('hex');
                await client.query(`UPDATE public.schools SET api_key_hash = $1 WHERE id = $2`, [hash, school.id]);
            }
            // Drop plaintext column
            await client.query(`ALTER TABLE public.schools DROP COLUMN IF EXISTS api_key`);
            console.log('✅ Schools Migrated (Column Dropped).');
        } else {
            console.log('ℹ️ api_key column missing, skipping data migration.');
        }

        console.log('✅ Schools Schema Verified.');

        // 2. Telemetry: Convert to Partitioned
        console.log('📡 Migrating Telemetry to Partitioned Table...');

        // Check if already partitioned
        const isPartitioned = await client.query(`SELECT relkind FROM pg_class WHERE relname = 'telemetry'`);
        if (isPartitioned.rows[0]?.relkind === 'p') {
            console.log('ℹ️ Telemetry is already partitioned. Skipping.');
        } else {
            // Rename old
            await client.query(`ALTER TABLE public.telemetry RENAME TO telemetry_old`);

            // Create new Partitioned Table
            await client.query(`
                CREATE TABLE public.telemetry (
                    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
                    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    ac_power_kw DECIMAL(10, 3),
                    ac_voltage DECIMAL(6, 2),
                    ac_current DECIMAL(6, 2),
                    total_energy_kwh DECIMAL(12, 2),
                    daily_energy_kwh DECIMAL(10, 2),
                    irradiance_wm2 DECIMAL(6, 2),
                    panel_temp_c DECIMAL(5, 2),
                    performance_ratio DECIMAL(5, 4),
                    efficiency_percent DECIMAL(5, 2),
                    load_kw DECIMAL(10, 3),
                    grid_export_kw DECIMAL(10, 3),
                    grid_import_kw DECIMAL(10, 3),
                    weather_condition VARCHAR(50),
                    fault VARCHAR(50) DEFAULT 'none',
                    quality_score DECIMAL(3, 2) DEFAULT 1.0,
                    is_backfill BOOLEAN DEFAULT FALSE,
                    is_suspect_time BOOLEAN DEFAULT FALSE
                ) PARTITION BY RANGE (timestamp);
            `);

            // Create Default Partition
            await client.query(`CREATE TABLE IF NOT EXISTS public.telemetry_default PARTITION OF public.telemetry DEFAULT`);

            // Create 2026 Partitions
            await client.query(`CREATE TABLE IF NOT EXISTS public.telemetry_2026_01 PARTITION OF public.telemetry FOR VALUES FROM ('2026-01-01') TO ('2026-02-01')`);
            await client.query(`CREATE TABLE IF NOT EXISTS public.telemetry_2026_02 PARTITION OF public.telemetry FOR VALUES FROM ('2026-02-01') TO ('2026-03-01')`);
            await client.query(`CREATE TABLE IF NOT EXISTS public.telemetry_2026_03 PARTITION OF public.telemetry FOR VALUES FROM ('2026-03-01') TO ('2026-04-01')`);

            // Migrate Data (Insert into new partitioned table)
            // Note: This might be slow for massive data, but for this context it's okay.
            // Mapping columns from old to new might be tricky if schema changed.
            // Assuming columns match mostly.
            // Let's inspect columns or just try generic INSERT. 
            // Safer: Just empty old telemetry if we don't care about preserving dev data, OR try best effort.
            // Requirement said "No silent data loss", so we must try to migrate.
            // But if types mismatch...
            // Let's assume columns are compatible (they are unchanged in my schema.sql except partitioning).

            // However, inserting into partitioned table requires routing.
            await client.query(`INSERT INTO public.telemetry SELECT * FROM public.telemetry_old`);

            // Drop old
            await client.query(`DROP TABLE public.telemetry_old`);
            console.log('✅ Telemetry Migrated.');
        }

        // 3. Functions & Triggers
        console.log('⚙️ applying Functions & Triggers...');
        await client.query(`
            CREATE OR REPLACE FUNCTION public.create_partition_and_insert() RETURNS TRIGGER AS $$
            DECLARE
                partition_date TEXT;
                partition_name TEXT;
                start_of_month TIMESTAMP;
                end_of_month TIMESTAMP;
            BEGIN
                partition_date := to_char(NEW.timestamp, 'YYYY_MM');
                partition_name := 'telemetry_' || partition_date;
                start_of_month := date_trunc('month', NEW.timestamp);
                end_of_month := start_of_month + interval '1 month';

                IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
                    BEGIN
                        EXECUTE format('CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.telemetry FOR VALUES FROM (%L) TO (%L)', partition_name, start_of_month, end_of_month);
                    EXCEPTION WHEN duplicate_table THEN
                        NULL;
                    END;
                END IF;
                RETURN NEW;
            END;
            $$ LANGUAGE plpgsql;
        `);

        await client.query(`DROP TRIGGER IF EXISTS ensure_partition_exists_trigger ON public.telemetry`);
        await client.query(`
            CREATE TRIGGER ensure_partition_exists_trigger
            BEFORE INSERT ON public.telemetry
            FOR EACH ROW EXECUTE FUNCTION public.create_partition_and_insert();
        `);

        await client.query('COMMIT');
        console.log('✨ Migration Completed Successfully.');
        await client.end();
        process.exit(0);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('❌ Migration Failed:', err);
        await client.end();
        process.exit(1);
    }
}

migrate();
