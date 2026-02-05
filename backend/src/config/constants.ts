export const BUSINESS_LOGIC = {
    // Financial Defaults (Fallbacks if DB is empty)
    DEFAULT_ELECTRICITY_RATE_IDR: 1500, // Commercial Tariff
    DEFAULT_FEED_IN_TARIFF_IDR: 0,      // No export tariff by default
    DEFAULT_CARBON_INTENSITY_KG: 0.85,  // Grid factor
    DEFAULT_IRR_PERCENT: 0.12,          // 12% Internal Rate of Return

    // System Limits
    MAX_ALERTS_LIMIT: 50,
    TELEMETRY_Drift_WARNING_SEC: 86400, // 24 hours
    TELEMETRY_BACKFILL_SEC: 600,        // 10 minutes

    // Caching
    USER_SESSION_TTL_MS: 60 * 1000,     // 1 minute
    DASHBOARD_CACHE_TTL_MS: 5 * 60 * 1000 // Future use
};
