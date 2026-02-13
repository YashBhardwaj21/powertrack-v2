-- Add Daily Load Total
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='telemetry' AND column_name='daily_load_kwh') THEN
        ALTER TABLE public.telemetry ADD COLUMN daily_load_kwh DECIMAL(12, 2) DEFAULT 0;
    END IF;
END $$;
