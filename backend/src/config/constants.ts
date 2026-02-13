export const BUSINESS_LOGIC = {
    // Financial Defaults (Fallbacks if DB is empty)
    DEFAULT_ELECTRICITY_RATE_IDR: 1500, // Commercial Tariff
    DEFAULT_FEED_IN_TARIFF_IDR: 0,      // No export tariff by default
    DEFAULT_CARBON_INTENSITY_KG: 0.85,  // Grid factor
    DEFAULT_IRR_PERCENT: 0.12,          // 12% Internal Rate of Return

    // System Limits
    MAX_ALERTS_LIMIT: 50,
    TELEMETRY_DRIFT_WARNING_SEC: 86400, // 24 hours
    TELEMETRY_BACKFILL_SEC: 600,        // 10 minutes

    // Caching
    USER_SESSION_TTL_MS: 60 * 1000,     // 1 minute
    DASHBOARD_CACHE_TTL_MS: 5 * 60 * 1000 // Future use
};

// ═══════════ SIMULATION CONSTANTS ═══════════
export const SIMULATION = {
    // Timing Configuration
    TICK_INTERVAL_MS: parseInt(process.env.SIMULATOR_INTERVAL_MS || '10000', 10), // 10 seconds
    CACHE_TTL_MS: parseInt(process.env.SIMULATOR_CACHE_TTL_MS || (process.env.NODE_ENV === 'development' ? '60000' : '120000'), 10),
    MAX_DELTA_SECONDS: 30, // Prevent huge energy spikes if server sleeps

    // Physics Constants (Industry Standard Values)
    POWER_FACTOR: 0.95,           // Typical AC power factor
    SYSTEM_EFFICIENCY: 0.85,      // DC to AC conversion + losses
    AC_VOLTAGE: 230,              // Standard voltage (V)

    // Solar Performance
    PEAK_IRRADIANCE: 1000,        // W/m² at solar noon, clear sky
    MIN_IRRADIANCE_THRESHOLD: 10, // W/m² - below this, consider 0 output
    PANEL_AMBIENT_TEMP: 25,       // Base ambient temperature (°C)
    PANEL_TEMP_RISE: 15,          // Temperature rise per unit daylight factor

    // Weather Probability Distribution
    WEATHER_CHANGE_PROBABILITY: 0.01, // 1% chance per tick (~1% every 10 seconds)
    WEATHER_SUNNY_PROB: 0.55,
    WEATHER_PARTLY_CLOUDY_PROB: 0.75,  // Cumulative: 0.55 + 0.20
    WEATHER_CLOUDY_PROB: 0.90,         // Cumulative: 0.75 + 0.15
    // Rainy is the remainder (0.10)

    // Database Protection
    RETRY_MAX_ATTEMPTS: 3,
    RETRY_BASE_DELAY_MS: 1000,
    RETRY_MAX_DELAY_MS: 5000,

    // Advisory Lock (Prevent duplicate simulators)
    ADVISORY_LOCK_ID: 987654321, // PostgreSQL advisory lock identifier
};

// ═══════════ ENVIRONMENTAL FACTORS ═══════════
export const ENVIRONMENTAL = {
    // Carbon Conversion Factors

    // System Projections
    SOLAR_SYSTEM_LIFETIME_YEARS: 20,  // Standard panel warranty period
    CONSERVATIVE_YIELD_KWH_PER_KWP: 3.5, // Daily yield for payback calculations
};

// ═══════════ WEATHER MULTIPLIERS ═══════════
export const WEATHER_FACTOR: Record<string, number> = {
    sunny: 1.0,
    partly_cloudy: 0.7,
    cloudy: 0.4,
    rainy: 0.15
};

// ═══════════ STORAGE MOCK DATA (Placeholder) ═══════════
// TODO: Replace with actual calculated metrics
export const STORAGE_METRICS = {
    DB_ENGINE: 'PostgreSQL 14 (Partitioned)',
    COMPRESSION_RATIO: 3.2,           // Placeholder - calculate actual
    INGESTION_RATE_MPS: 0.5,          // Placeholder - calculate actual
    RETENTION_RAW_DAYS: 90,
    RETENTION_AGGREGATED_DAYS: 730,   // 2 years
};

// ═══════════ ML MODEL METRICS (Placeholder) ═══════════
// TODO: Replace with actual model tracking or remove
export const ML_METRICS = {
    VERSION: '1.0.0-placeholder',
    RMSE: 0.15,
    MAPE: 5.2,
    RESIDUALS_TREND: [0.1, 0.05, -0.02, 0.03, -0.01],
    ANOMALY_PRECISION: 0.92,
    ANOMALY_RECALL: 0.88,
    ANOMALY_F1: 0.90,
};
