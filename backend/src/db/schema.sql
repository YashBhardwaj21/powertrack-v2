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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    timezone VARCHAR(50) DEFAULT 'Asia/Jakarta' NOT NULL -- Enforced: Asia/Jakarta
);

-- =========================================================
-- USERS
-- =========================================================
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'viewer', -- 'admin', 'editor', 'viewer', 'school_admin'
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    last_login TIMESTAMPTZ,
    reset_token VARCHAR(255),
    reset_expires TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =========================================================
-- TELEMETRY (PARTITIONED)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.telemetry (
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_at TIMESTAMPTZ DEFAULT NOW(),
    ac_power_kw DECIMAL(10, 3),
    ac_voltage DECIMAL(6, 2),
    ac_current DECIMAL(6, 2),
    total_energy_kwh DECIMAL(14, 4) CHECK (total_energy_kwh >= 0), -- Hardened: Precision & Check
    daily_energy_kwh DECIMAL(14, 4) CHECK (daily_energy_kwh >= 0), -- Hardened: Precision & Check
    daily_load_kwh DECIMAL(14, 4),   -- Added: Missing column
    daily_export_kwh DECIMAL(14, 4), -- Hardened: Precision
    daily_import_kwh DECIMAL(14, 4), -- Hardened: Precision
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
    is_suspect_time BOOLEAN DEFAULT FALSE,
    local_date DATE -- Optimized: Pre-computed local date
) PARTITION BY RANGE (timestamp);

-- 1. Default Partition (Safety Net)
CREATE TABLE IF NOT EXISTS public.telemetry_default PARTITION OF public.telemetry DEFAULT;

-- 2. Pre-seed Partitions (Example)
CREATE TABLE IF NOT EXISTS public.telemetry_2026_01 PARTITION OF public.telemetry
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');
-- ... (other partitions managed by scripts/ensure_partitions) ...

-- 3. Partition Management Helper (Manual Call, no longer Trigger)
CREATE OR REPLACE FUNCTION public.ensure_partitions_for_year(target_year INT)
RETURNS VOID AS $$
DECLARE
    start_date DATE;
    end_date DATE;
    partition_name TEXT;
    i INT;
BEGIN
    FOR i IN 1..12 LOOP
        start_date := make_date(target_year, i, 1);
        end_date := start_date + interval '1 month';
        partition_name := format('telemetry_%s_%s', target_year, to_char(start_date, 'MM'));
        
        IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = partition_name) THEN
            EXECUTE format(
                'CREATE TABLE IF NOT EXISTS public.%I PARTITION OF public.telemetry FOR VALUES FROM (%L) TO (%L)',
                partition_name, start_date, end_date
            );
            RAISE NOTICE 'Created partition %', partition_name;
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- =========================================================
-- TELEMETRY DAILY (Aggregated)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.telemetry_daily (
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    daily_energy_kwh DECIMAL(14, 4),
    daily_export_kwh DECIMAL(14, 4),
    daily_import_kwh DECIMAL(14, 4),
    peak_power_kw DECIMAL(10, 3),
    avg_temp_c DECIMAL(5, 2),
    avg_irradiance_wm2 DECIMAL(6, 2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (school_id, day)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_daily_school_day ON public.telemetry_daily(school_id, day DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_local_date ON public.telemetry(school_id, local_date);

-- Function to Aggregate Daily Stats (Updated for local_date)
CREATE OR REPLACE PROCEDURE public.aggregate_daily_stats(target_school_id UUID, target_day DATE)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.telemetry_daily (
        school_id, day, 
        daily_energy_kwh, daily_export_kwh, daily_import_kwh,
        peak_power_kw, avg_temp_c, avg_irradiance_wm2
    )
    SELECT 
        school_id,
        local_date, -- Use pre-computed local_date
        MAX(total_energy_kwh) - MIN(total_energy_kwh), -- Robust: Max - Min
        MAX(daily_export_kwh),
        MAX(daily_import_kwh),
        MAX(ac_power_kw),
        AVG(panel_temp_c),
        AVG(irradiance_wm2)
    FROM public.telemetry
    WHERE school_id = target_school_id 
    AND local_date = target_day
    GROUP BY school_id, local_date
    ON CONFLICT (school_id, day) DO UPDATE SET
        daily_energy_kwh = EXCLUDED.daily_energy_kwh,
        daily_export_kwh = EXCLUDED.daily_export_kwh,
        daily_import_kwh = EXCLUDED.daily_import_kwh,
        updated_at = NOW();
END;
$$;

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
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schools_api_key_hash ON public.schools(api_key_hash);

CREATE INDEX IF NOT EXISTS idx_telemetry_school_time ON public.telemetry(school_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_alerts_school_unresolved
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

-- =========================================================
-- SIMULATOR STATE (For persistent midnight reset tracking)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.simulator_state (
    school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
    last_sim_date DATE NOT NULL DEFAULT CURRENT_DATE
);

-- =========================================================
-- SCHEMA MIGRATIONS (Idempotent Column Additions)
-- =========================================================

-- Add daily_self_consumed_kwh to telemetry
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='telemetry' AND column_name='daily_self_consumed_kwh') THEN
        ALTER TABLE public.telemetry ADD COLUMN daily_self_consumed_kwh NUMERIC DEFAULT 0;
    END IF;
END $$;

-- Add baseline_load_kw to schools (for stable load simulation)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='schools' AND column_name='baseline_load_kw') THEN
        ALTER TABLE public.schools ADD COLUMN baseline_load_kw NUMERIC;
    END IF;
END $$;
