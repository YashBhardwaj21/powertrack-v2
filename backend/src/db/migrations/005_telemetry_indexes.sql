-- Performance indexes for telemetry queries
-- Create indexes CONCURRENTLY to avoid blocking writes

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telemetry_school_timestamp 
    ON public.telemetry(school_id, timestamp DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telemetry_daily_school_day 
    ON public.telemetry_daily(school_id, day DESC);

-- Composite index for common filtering patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telemetry_timestamp_school 
    ON public.telemetry(timestamp DESC, school_id);

-- Index for daily aggregation queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_telemetry_date_school 
    ON public.telemetry(DATE(timestamp), school_id);
