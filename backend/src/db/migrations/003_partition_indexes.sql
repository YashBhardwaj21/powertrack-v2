-- Migration: Automate Telemetry Partitioning & Indexing
-- 
-- 1. Creates a procedure to create monthly partitions
-- 2. Ensures indexes are created on (school_id, timestamp) for each partition
-- 3. Sets up a trigger mechanism (or allows manual cron calling)

-- Function to create partition for a given month associated with a timestamp
CREATE OR REPLACE FUNCTION create_telemetry_partition(date_start DATE)
RETURNS void AS $$
DECLARE
    partition_name TEXT;
    start_str TEXT;
    end_str TEXT;
BEGIN
    -- Format: telemetry_2024_01
    partition_name := 'telemetry_' || to_char(date_start, 'YYYY_MM');
    start_str := to_char(date_trunc('month', date_start), 'YYYY-MM-DD');
    end_str := to_char(date_trunc('month', date_start) + interval '1 month', 'YYYY-MM-DD');

    -- Create Partition Table
    EXECUTE format('
        CREATE TABLE IF NOT EXISTS %I PARTITION OF public.telemetry
        FOR VALUES FROM (%L) TO (%L)
    ', partition_name, start_str, end_str);

    -- Create Indexes on Partition
    -- Index 1: School + Time (Most common query pattern: Dashboard)
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I_school_time_idx ON %I (school_id, timestamp DESC)
    ', partition_name, partition_name);

    -- Index 2: Time Only (Global aggregations)
    EXECUTE format('
        CREATE INDEX IF NOT EXISTS %I_time_idx ON %I (timestamp DESC)
    ', partition_name, partition_name);

    RAISE NOTICE 'Partition % created/verified with indexes', partition_name;
END;
$$ LANGUAGE plpgsql;

-- Ensure current and next month exist
SELECT create_telemetry_partition(CURRENT_DATE);
SELECT create_telemetry_partition(CURRENT_DATE + INTERVAL '1 month');
