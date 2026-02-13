-- 009_schema_hardening.sql
-- Description: Adds data integrity constraints, local_date for optimization, and precision updates.

-- 1. HARDEN SCHOOLS TIMEZONE
-- =========================================================
UPDATE public.schools SET timezone = 'Asia/Jakarta' WHERE timezone IS NULL;
ALTER TABLE public.schools ALTER COLUMN timezone SET NOT NULL;

-- 2. TELEMETRY PRECISION UPDATES
-- =========================================================
-- Increasing precision to DECIMAL(14,4) for accuracy
-- Missing column fix: daily_load_kwh
ALTER TABLE public.telemetry ADD COLUMN IF NOT EXISTS daily_load_kwh DECIMAL(14, 4);
ALTER TABLE public.telemetry ALTER COLUMN total_energy_kwh TYPE DECIMAL(14, 4);
ALTER TABLE public.telemetry ALTER COLUMN daily_energy_kwh TYPE DECIMAL(14, 4);
ALTER TABLE public.telemetry ALTER COLUMN daily_import_kwh TYPE DECIMAL(14, 4);
ALTER TABLE public.telemetry ALTER COLUMN daily_export_kwh TYPE DECIMAL(14, 4);

-- 3. DATA INTEGRITY CONSTRAINTS
-- =========================================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_total_energy_positive') THEN
        ALTER TABLE public.telemetry ADD CONSTRAINT check_total_energy_positive CHECK (total_energy_kwh >= 0);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'check_daily_energy_positive') THEN
        ALTER TABLE public.telemetry ADD CONSTRAINT check_daily_energy_positive CHECK (daily_energy_kwh >= 0);
    END IF;
END $$;

-- 4. OPTIMIZATION: LOCAL DATE
-- =========================================================
-- Add local_date column to avoid expensive OTF timezone conversion in large queries
ALTER TABLE public.telemetry ADD COLUMN IF NOT EXISTS local_date DATE;

-- Create efficient indexes
CREATE INDEX IF NOT EXISTS idx_telemetry_local_date ON public.telemetry(school_id, local_date);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp_global ON public.telemetry(timestamp DESC);

-- 5. SCALABLE PARTITIONING
-- =========================================================
-- Remove the per-row trigger which causes locking/performance issues
DROP TRIGGER IF EXISTS ensure_partition_exists_trigger ON public.telemetry;
DROP FUNCTION IF EXISTS public.create_partition_and_insert();

-- Create a helper to pre-create partitions
CREATE OR REPLACE FUNCTION public.ensure_partitions_for_year(target_year INT)
RETURNS VOID AS $$
DECLARE
    month_idx INT;
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    FOR month_idx IN 1..12 LOOP
        -- Partition naming convention: telemetry_YYYY_MM
        partition_name := format('telemetry_%s_%s', target_year, to_char(month_idx, 'FM00'));
        start_date := make_date(target_year, month_idx, 1);
        end_date := start_date + interval '1 month';
        
        -- Check if table exists in public schema
        IF NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE c.relname = partition_name AND n.nspname = 'public') THEN
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.telemetry FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
            RAISE NOTICE 'Created partition %', partition_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Pre-seed partitions for the current and next year
SELECT public.ensure_partitions_for_year(EXTRACT(YEAR FROM NOW())::INT);
SELECT public.ensure_partitions_for_year(EXTRACT(YEAR FROM NOW())::INT + 1);

-- 6. AGGREGATION LOGIC (Robust)
-- =========================================================
-- Updated procedure that takes a specific school and LOCAL date
-- Uses MAX(total) - MIN(total) to be robust against daily counter resets
CREATE OR REPLACE PROCEDURE public.aggregate_daily_stats(target_school_id UUID, target_date DATE)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.telemetry_daily (
        school_id, day, 
        daily_energy_kwh, daily_export_kwh, daily_import_kwh,
        peak_power_kw, avg_temp_c, avg_irradiance_wm2
    )
    SELECT 
        target_school_id,
        target_date,
        -- Robust Delta Calculation:
        MAX(total_energy_kwh) - MIN(total_energy_kwh),
        -- For import/export, we assume they are cumulative counters in telemetry.
        -- If they are NOT cumulative (i.e. if they reset daily), we should use MAX().
        -- If they are cumulative, MAX() - MIN() is correct.
        -- Given current ambiguity, we will assume they behave like total_energy_kwh if we fix the simulator.
        -- Current simulator fix Plan implies they will be cumulative counters.
        GREATEST(MAX(daily_export_kwh) - MIN(daily_export_kwh), 0),
        GREATEST(MAX(daily_import_kwh) - MIN(daily_import_kwh), 0),
        MAX(ac_power_kw),
        AVG(panel_temp_c),
        AVG(irradiance_wm2)
    FROM public.telemetry
    WHERE school_id = target_school_id AND local_date = target_date
    GROUP BY school_id, local_date
    ON CONFLICT (school_id, day) DO UPDATE SET
        daily_energy_kwh = EXCLUDED.daily_energy_kwh,
        daily_export_kwh = EXCLUDED.daily_export_kwh,
        daily_import_kwh = EXCLUDED.daily_import_kwh,
        updated_at = NOW();
END;
$$;
