-- Migration: Seed System Parameters
-- 
-- Adds default financial and environmental constraints if they don't exist.
-- Usage: psql -d <dbname> -f seed_parameters.sql

INSERT INTO public.system_parameters (key, value, unit, label, updated_at)
VALUES 
    ('electricity_rate_idr', 1444.7, 'IDR/kWh', 'Electricity Tariff', NOW()),
    ('carbon_factor_kg_per_kwh', 0.85, 'kg/kWh', 'Grid Carbon Intensity', NOW()),
    ('default_irr_percent', 0.125, 'ratio', 'Target IRR', NOW()),
    ('default_device_profile_id', 0, 'uuid', 'Default Device Profile', NOW()) -- Placeholder
ON CONFLICT (key) DO NOTHING;
