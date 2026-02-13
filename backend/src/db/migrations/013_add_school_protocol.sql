-- Add connection_protocol to schools table
-- Default to 'http' to maintain backward compatibility

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='schools' AND column_name='connection_protocol') THEN
        ALTER TABLE public.schools ADD COLUMN connection_protocol VARCHAR(50) DEFAULT 'http';
    END IF;
END $$;
