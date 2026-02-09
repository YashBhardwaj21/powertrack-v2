CREATE TABLE IF NOT EXISTS simulator_checkpoint (
    school_id UUID PRIMARY KEY REFERENCES schools(id),
    last_sim_date DATE NOT NULL,
    last_verified_total_kwh NUMERIC(10, 4) DEFAULT 0,
    daily_energy_kwh NUMERIC(10, 4) DEFAULT 0,
    daily_export_kwh NUMERIC(10, 4) DEFAULT 0,
    daily_import_kwh NUMERIC(10, 4) DEFAULT 0,
    base_load_kw NUMERIC(10, 4) DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups (though PK is already indexed)
CREATE INDEX IF NOT EXISTS idx_simulator_checkpoint_updated ON simulator_checkpoint(updated_at);
