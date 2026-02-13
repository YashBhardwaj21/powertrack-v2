-- Add Lifetime Totals for Load and Grid
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='telemetry' AND column_name='total_load_kwh') THEN
        ALTER TABLE public.telemetry ADD COLUMN total_load_kwh DECIMAL(12, 2) DEFAULT 0;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='telemetry' AND column_name='total_import_kwh') THEN
        ALTER TABLE public.telemetry ADD COLUMN total_import_kwh DECIMAL(12, 2) DEFAULT 0;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='telemetry' AND column_name='total_export_kwh') THEN
        ALTER TABLE public.telemetry ADD COLUMN total_export_kwh DECIMAL(12, 2) DEFAULT 0;
    END IF;
END $$;
