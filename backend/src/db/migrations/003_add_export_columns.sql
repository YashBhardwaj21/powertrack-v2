
-- Migration: Add Daily Export/Import Columns
-- Idempotent execution
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='telemetry' AND column_name='daily_export_kwh') THEN
        ALTER TABLE public.telemetry ADD COLUMN daily_export_kwh DECIMAL(10, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='telemetry' AND column_name='daily_import_kwh') THEN
        ALTER TABLE public.telemetry ADD COLUMN daily_import_kwh DECIMAL(10, 2) DEFAULT 0;
    END IF;
END $$;
