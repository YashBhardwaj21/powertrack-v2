-- =========================================================
-- EXTENSIONS
-- =========================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- SYSTEM PARAMETERS (Global Constants)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.system_parameters (
    key VARCHAR(100) PRIMARY KEY,
    value DECIMAL(20, 10) NOT NULL,
    unit VARCHAR(50),
    label TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed defaults
INSERT INTO public.system_parameters (key, value, unit, label)
VALUES 
    ('electricity_rate_idr', 1444.7, 'IDR/kWh', 'Commercial Electricity Tariff'),
    ('carbon_intensity_kg_per_kwh', 0.85, 'kg CO2/kWh', 'Grid Carbon Intensity Factor')
ON CONFLICT (key) DO NOTHING;

-- =========================================================
-- DEVICE PROFILES (Field Mapping)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.device_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    vendor VARCHAR(255),
    protocol VARCHAR(50) DEFAULT 'http', -- http, mqtt
    version VARCHAR(20) DEFAULT '1.0',
    field_map JSONB DEFAULT '{
        "power": "power_w",
        "voltage": "voltage",
        "current": "current_a",
        "energy_today": "daily_kwh",
        "energy_total": "total_kwh"
    }'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default profiles
INSERT INTO public.device_profiles (name, vendor, protocol, version)
VALUES ('PowerTrack Standard', 'Generic', 'http', '1.0')
ON CONFLICT DO NOTHING;

-- =========================================================
-- SCHOOLS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100),
    district VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    total_capacity_kwp DECIMAL(10, 2),
    total_cost_idr DECIMAL(15, 2),
    api_key_hash TEXT UNIQUE NOT NULL,
    device_profile_id UUID REFERENCES public.device_profiles(id),
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- View for active schools (simple filtering)
CREATE OR REPLACE VIEW public.active_schools AS
SELECT * FROM public.schools WHERE deleted_at IS NULL;

-- =========================================================
-- USERS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'viewer'
        CHECK (role IN ('admin', 'school_admin', 'viewer')),
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- =========================================================
-- TELEMETRY (PARTITIONED)
-- =========================================================
DROP TABLE IF EXISTS public.telemetry CASCADE;

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

-- 1. Default Partition (Safety Net)
-- Ensures no data is ever lost even if auto-creation fails
CREATE TABLE IF NOT EXISTS public.telemetry_default PARTITION OF public.telemetry DEFAULT;

-- 2. Pre-seed 2026 Partitions (Optional but good for performance)
CREATE TABLE IF NOT EXISTS public.telemetry_2026_01 PARTITION OF public.telemetry
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
CREATE TABLE IF NOT EXISTS public.telemetry_2026_02 PARTITION OF public.telemetry
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
CREATE TABLE IF NOT EXISTS public.telemetry_2026_03 PARTITION OF public.telemetry
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- 3. Auto-Partitioning Trigger Function
CREATE OR REPLACE FUNCTION public.create_partition_and_insert() RETURNS TRIGGER AS $$
DECLARE
    partition_date TEXT;
    partition_name TEXT;
    start_of_month TIMESTAMP;
    end_of_month TIMESTAMP;
BEGIN
    -- Calculate partition name based on the timestamp of the new row
    partition_date := to_char(NEW.timestamp, 'YYYY_MM');
    partition_name := 'telemetry_' || partition_date;
    start_of_month := date_trunc('month', NEW.timestamp);
    end_of_month := start_of_month + interval '1 month';

    -- Check if partition exists
    IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
        BEGIN
            -- Try to create it
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.telemetry FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_of_month, end_of_month
            );
            -- Add indexes to the new partition specifically if needed, 
            -- though PG11+ attaches parent indexes automatically.
        EXCEPTION WHEN duplicate_table THEN
            -- Ignore race condition if it was just created
            NULL;
        END;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Correct Trigger Attachment
-- Note: 'BEFORE INSERT' on a partitioned table is supported in PG13+.
-- If running older PG, this might need to be an app-level logic or a BEFORE trigger on the DEFAULT partition.
-- Assuming PG14+ as per 'Storage Stats'.
CREATE TRIGGER ensure_partition_exists_trigger
    BEFORE INSERT ON public.telemetry
    FOR EACH ROW EXECUTE FUNCTION public.create_partition_and_insert();

-- =========================================================
-- ALERTS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    type VARCHAR(50),
    severity VARCHAR(20)
        CHECK (severity IN ('critical', 'warning', 'info')),
    message TEXT,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- INDEXES
-- =========================================================
DROP INDEX IF EXISTS idx_users_email;
CREATE INDEX idx_users_email ON public.users(email);

DROP INDEX IF EXISTS idx_schools_api_key_hash;
CREATE UNIQUE INDEX idx_schools_api_key_hash ON public.schools(api_key_hash);

CREATE INDEX IF NOT EXISTS idx_telemetry_school_time ON public.telemetry(school_id, timestamp DESC);

DROP INDEX IF EXISTS idx_alerts_school_unresolved;
CREATE INDEX idx_alerts_school_unresolved
    ON public.alerts(school_id, timestamp DESC)
    WHERE resolved = FALSE;

-- =========================================================
-- UPDATED_AT TRIGGERS
-- =========================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_schools_updated_at ON public.schools;
CREATE TRIGGER update_schools_updated_at
BEFORE UPDATE ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
