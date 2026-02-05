
-- Migration: Add Telemetry Daily Aggregation
-- Optimizes long-term storage and query performance

CREATE TABLE IF NOT EXISTS public.telemetry_daily (
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    daily_energy_kwh DECIMAL(10, 2),
    daily_export_kwh DECIMAL(10, 2),
    daily_import_kwh DECIMAL(10, 2),
    peak_power_kw DECIMAL(10, 3),
    avg_temp_c DECIMAL(5, 2),
    avg_irradiance_wm2 DECIMAL(6, 2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (school_id, day)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_daily_school_day ON public.telemetry_daily(school_id, day DESC);

-- Function to Aggregate Yesterday's Data
CREATE OR REPLACE PROCEDURE public.aggregate_daily_stats(target_date DATE)
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
        target_date,
        MAX(daily_energy_kwh) - MIN(daily_energy_kwh), -- Approximate if counter resets, otherwise just MAX
        MAX(daily_export_kwh), -- Cumulative
        MAX(daily_import_kwh), -- Cumulative
        MAX(ac_power_kw),
        AVG(panel_temp_c),
        AVG(irradiance_wm2)
    FROM public.telemetry
    WHERE date_trunc('day', timestamp AT TIME ZONE 'Asia/Jakarta') = target_date
    GROUP BY school_id
    ON CONFLICT (school_id, day) DO UPDATE SET
        daily_energy_kwh = EXCLUDED.daily_energy_kwh,
        daily_export_kwh = EXCLUDED.daily_export_kwh,
        daily_import_kwh = EXCLUDED.daily_import_kwh,
        updated_at = NOW();
END;
$$;
