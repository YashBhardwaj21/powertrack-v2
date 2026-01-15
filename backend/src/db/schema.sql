-- =========================================================
-- EXTENSIONS
-- =========================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

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
    api_key TEXT UNIQUE, -- 🔥 GENERATED IN BACKEND
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
-- TELEMETRY
-- =========================================================
CREATE TABLE IF NOT EXISTS public.telemetry (
    id BIGSERIAL PRIMARY KEY,
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
    fault VARCHAR(50) DEFAULT 'none'
        CHECK (fault IN ('none', 'underperf', 'comm_down', 'ground_fault', 'arc_fault'))
);

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
CREATE INDEX IF NOT EXISTS idx_schools_api_key ON public.schools(api_key);
CREATE INDEX IF NOT EXISTS idx_telemetry_school_time
    ON public.telemetry(school_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_telemetry_timestamp
    ON public.telemetry(timestamp DESC);
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

CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_schools_updated_at
BEFORE UPDATE ON public.schools
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
