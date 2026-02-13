-- 010_enforce_jakarta.sql
-- Description: Standardizes the entire system to Asia/Jakarta (WIB) timezone.

-- 1. Update Schools
-- =========================================================
-- Force all existing schools to Jakarta
UPDATE public.schools SET timezone = 'Asia/Jakarta';

-- Set default for new schools
ALTER TABLE public.schools ALTER COLUMN timezone SET DEFAULT 'Asia/Jakarta';
ALTER TABLE public.schools ALTER COLUMN timezone SET NOT NULL;

-- 2. Update Aggregation Logic (Hardcoded Jakarta)
-- =========================================================
DROP PROCEDURE IF EXISTS public.aggregate_daily_stats(UUID, DATE);

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
        target_school_id,
        target_day,
        -- Robust Delta Calculation:
        MAX(total_energy_kwh) - MIN(total_energy_kwh),
        GREATEST(MAX(daily_export_kwh) - MIN(daily_export_kwh), 0),
        GREATEST(MAX(daily_import_kwh) - MIN(daily_import_kwh), 0),
        MAX(ac_power_kw),
        AVG(panel_temp_c),
        AVG(irradiance_wm2)
    FROM public.telemetry
    WHERE school_id = target_school_id 
    -- Explicitly cast timestamp to Jakarta Date
    AND DATE(timestamp AT TIME ZONE 'Asia/Jakarta') = target_day
    GROUP BY school_id
    ON CONFLICT (school_id, day) DO UPDATE SET
        daily_energy_kwh = EXCLUDED.daily_energy_kwh,
        daily_export_kwh = EXCLUDED.daily_export_kwh,
        daily_import_kwh = EXCLUDED.daily_import_kwh,
        updated_at = NOW();
END;
$$;
