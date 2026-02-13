-- =========================================================
-- TELEMETRY HOURLY (Aggregated)
-- =========================================================
CREATE TABLE IF NOT EXISTS public.telemetry_hourly (
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    bucket TIMESTAMPTZ NOT NULL, -- The start of the hour
    avg_power_kw DECIMAL(10, 3),
    total_energy_kwh DECIMAL(12, 2), -- Snapshot at end of hour
    hourly_energy_kwh DECIMAL(10, 2), -- Production during this hour
    avg_load_kw DECIMAL(10, 3),
    avg_import_kw DECIMAL(10, 3),
    avg_export_kw DECIMAL(10, 3),
    avg_irradiance_wm2 DECIMAL(6, 2),
    avg_temp_c DECIMAL(5, 2),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (school_id, bucket)
);

CREATE INDEX IF NOT EXISTS idx_telemetry_hourly_school_bucket ON public.telemetry_hourly(school_id, bucket DESC);

-- Function to Aggregate Hourly Data
CREATE OR REPLACE PROCEDURE public.aggregate_hourly_stats(target_hour TIMESTAMPTZ)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO public.telemetry_hourly (
        school_id, bucket, 
        avg_power_kw, total_energy_kwh, hourly_energy_kwh,
        avg_load_kw, avg_import_kw, avg_export_kw,
        avg_irradiance_wm2, avg_temp_c
    )
    SELECT 
        school_id,
        date_trunc('hour', timestamp),
        AVG(ac_power_kw),
        MAX(total_energy_kwh),
        MAX(daily_energy_kwh) - MIN(daily_energy_kwh), -- Approx for the hour
        AVG(load_kw),
        AVG(grid_import_kw),
        AVG(grid_export_kw),
        AVG(irradiance_wm2),
        AVG(panel_temp_c)
    FROM public.telemetry
    WHERE date_trunc('hour', timestamp) = target_hour
    GROUP BY 1, 2
    ON CONFLICT (school_id, bucket) DO UPDATE SET
        avg_power_kw = EXCLUDED.avg_power_kw,
        total_energy_kwh = EXCLUDED.total_energy_kwh,
        hourly_energy_kwh = EXCLUDED.hourly_energy_kwh,
        avg_load_kw = EXCLUDED.avg_load_kw,
        avg_import_kw = EXCLUDED.avg_import_kw,
        avg_export_kw = EXCLUDED.avg_export_kw,
        updated_at = NOW();
END;
$$;
