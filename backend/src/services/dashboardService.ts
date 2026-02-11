import { query } from '../db/index.js';
import { transformSchoolRow } from '../utils/transformers.js';
import { School } from '../types/index.js';
import { ENVIRONMENTAL, STORAGE_METRICS, ML_METRICS } from '../config/constants.js';

// ⚡ In-memory cache for system_parameters (reduces DB hits)
let systemParamsCache: Record<string, number> | null = null;
let systemParamsCacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Cache invalidation helper
export function invalidateSystemParamsCache() {
    systemParamsCache = null;
    systemParamsCacheExpiry = 0;
}

export const dashboardService = {
    async getSystemParams(keys: string[]) {
        const now = Date.now();

        // Return cached value if valid
        if (systemParamsCache && now < systemParamsCacheExpiry) {
            return systemParamsCache;
        }

        const result = await query(
            'SELECT * FROM public.system_parameters WHERE key = ANY($1)',
            [keys]
        );

        systemParamsCache = result.rows.reduce((acc, row) => {
            acc[row.key] = parseFloat(row.value);
            return acc;
        }, {} as Record<string, number>);

        systemParamsCacheExpiry = now + CACHE_TTL_MS;

        return systemParamsCache;
    },

    async getActiveSchools() {
        const result = await query('SELECT * FROM public.schools WHERE deleted_at IS NULL ORDER BY name');
        return result.rows
            .map(transformSchoolRow)
            .filter((s): s is School => s !== null);
    },

    async getCurrentTelemetry(schoolId?: string) {
        const sql = schoolId
            ? `SELECT DISTINCT ON (school_id) * FROM public.telemetry WHERE school_id = $1 ORDER BY school_id, timestamp DESC`
            : `SELECT DISTINCT ON (t.school_id) t.* FROM public.telemetry t JOIN public.schools s ON t.school_id = s.id WHERE s.deleted_at IS NULL ORDER BY t.school_id, t.timestamp DESC`;

        const result = await query(sql, schoolId ? [schoolId] : []);
        return result.rows;
    },

    async getAlerts(schoolId?: string) {
        const sql = schoolId
            ? `SELECT a.*, s.name AS school_name FROM public.alerts a JOIN public.schools s ON a.school_id = s.id WHERE a.resolved = FALSE AND a.school_id = $1 AND s.deleted_at IS NULL ORDER BY a.timestamp DESC LIMIT 50`
            : `SELECT a.*, s.name AS school_name FROM public.alerts a JOIN public.schools s ON a.school_id = s.id WHERE a.resolved = FALSE AND s.deleted_at IS NULL ORDER BY a.timestamp DESC LIMIT 50`;

        const result = await query(sql, schoolId ? [schoolId] : []);
        return result.rows;
    },

    calculateCommunityStats(telemetry: any[], tariff: number) {
        const safeData = Array.isArray(telemetry) ? telemetry : [];
        const totalExport = safeData.reduce((sum, t) => sum + (Number(t.grid_export_kw) || 0), 0);
        const totalImport = safeData.reduce((sum, t) => sum + (Number(t.grid_import_kw) || 0), 0);

        return {
            active_peers: safeData.length,
            total_surplus_kw: totalExport,
            total_deficit_kw: totalImport,
            net_grid_flow_kw: totalExport - totalImport,
            sharing_potential_idr: (totalExport - totalImport) * tariff,
        };
    },

    async getHourlyHistory(schoolId: string | undefined, interval: string, targetDate?: string) {
        // NOTE: We now ignore the _legacyTimezone param and join schools.timezone directly
        // If targetDate is provided, we look at that specific day (00:00 - 23:59)
        // If not, we look at last 48h (default)

        const timeFilter = targetDate
            ? `date_trunc('day', t.timestamp AT TIME ZONE s.tz) = date_trunc('day', $3::timestamp)`
            : `t.timestamp >= NOW() - INTERVAL '48 hours'`;

        const bucketStart = targetDate
            ? `$3::timestamp`
            : `date_trunc('day', NOW() AT TIME ZONE s.tz)`; // This logic in original was arguably 'start of today' vs 'now - 48h'. 
        // Actually the original query generate_series was from 'today start' to 'now'.
        // Let's align: 
        // targetDate -> Start of that day to End of that day
        // Default -> Start of Today to Now (or last 48h as per data query)

        // Correction: The original query used `generate_series(date_trunc('day', ...), date_trunc('hour', ...))` 
        // which implies it showed "Today so far".
        // The data query used `NOW() - INTERVAL '48 hours'`. 
        // To support "Show me what happened on [Date]", we need to generate buckets for THAT full day.

        const seriesStart = targetDate
            ? `$3::timestamp`
            : `date_trunc('day', NOW() AT TIME ZONE s.tz)`;

        const seriesEnd = targetDate
            ? `$3::timestamp + INTERVAL '23 hours 59 minutes'`
            : `date_trunc('hour', NOW() AT TIME ZONE s.tz)`; // Up to current hour

        const result = await query(
            `WITH school_tz AS (
                SELECT id, timezone as tz FROM public.schools
                WHERE ($2::uuid IS NULL OR id = $2::uuid)
                AND timezone IS NOT NULL
            ),
            time_buckets AS (
                SELECT s.id as school_id, generate_series(
                    ${seriesStart}, 
                    ${seriesEnd}, 
                    $1::interval
                ) as time_bucket
                FROM school_tz s
            ),
            per_school_hourly AS (
                SELECT 
                    date_trunc('hour', t.timestamp AT TIME ZONE s.tz) as time_bucket,
                    t.school_id,
                    AVG(t.ac_power_kw) as avg_power,
                    AVG(t.grid_export_kw) as avg_export_kw,
                    MAX(t.daily_energy_kwh) - MIN(t.daily_energy_kwh) as hourly_energy,
                    0 as day_export_cum
                FROM public.telemetry t
                JOIN school_tz s ON t.school_id = s.id
                WHERE ${timeFilter}
                AND ($2::uuid IS NULL OR t.school_id = $2::uuid)
                GROUP BY 1, 2
            ),
            system_hourly AS (
                SELECT
                    tb.time_bucket,
                    SUM(COALESCE(psh.avg_power, 0)) as sys_avg_power,
                    SUM(COALESCE(psh.avg_export_kw, 0)) as sys_avg_export,
                    SUM(COALESCE(psh.hourly_energy, 0)) as sys_hourly_energy
                FROM time_buckets tb
                LEFT JOIN per_school_hourly psh ON tb.time_bucket = psh.time_bucket AND tb.school_id = psh.school_id
                GROUP BY 1
            )
            SELECT 
                time_bucket as hour,
                COALESCE(sys_avg_power, 0) as avg_power,
                COALESCE(sys_avg_export, 0) as avg_export_power,
                GREATEST(COALESCE(sys_hourly_energy, 0), 0) as energy
            FROM system_hourly
            ORDER BY time_bucket ASC`,
            targetDate ? [interval, schoolId || null, targetDate] : [interval, schoolId || null]
        );

        return result.rows.map(row => ({
            hour: row.hour,
            avg_power: Number(row.avg_power),
            energy: Number(row.energy),
            avg_load: 0,
            avg_import: 0,
            avg_export: Number(row.avg_export_power)
        }));
    },

    async getDailyHistory(schoolId: string | undefined, _legacyTimezone?: string) {
        // NOTE: Dynamic timezone join
        const result = await query(
            `WITH school_tz AS (
                SELECT id, timezone as tz FROM public.schools
                WHERE ($1::uuid IS NULL OR id = $1::uuid)
                AND timezone IS NOT NULL
            ),
            days AS (
                SELECT s.id as school_id, generate_series(
                    (DATE(NOW() AT TIME ZONE s.tz) - INTERVAL '29 days')::timestamp, 
                    DATE(NOW() AT TIME ZONE s.tz)::timestamp,
                    '1 day'::interval
                ) as date
                FROM school_tz s
            ),
            -- 1. Aggregated History (Fast) - Exclude today to prevent duplication
            aggregated_daily AS (
                SELECT school_id, day, daily_energy_kwh
                FROM public.telemetry_daily
                WHERE day >= (CURRENT_DATE - INTERVAL '30 days')
                  AND day < CURRENT_DATE
            ),
            -- 2. Live Today (Real-time)
            live_today AS (
                SELECT 
                    t.school_id, 
                    DATE(t.timestamp AT TIME ZONE s.tz) as day, 
                    MAX(t.daily_energy_kwh) - MIN(t.daily_energy_kwh) as daily_energy_kwh
                FROM public.telemetry t
                JOIN school_tz s ON t.school_id = s.id
                WHERE t.timestamp >= NOW() - INTERVAL '24 hours' -- Optimization: Limit scan
                GROUP BY 1, 2
            ),
            -- 3. Union Sources
            combined_daily AS (
                SELECT school_id, day, daily_energy_kwh FROM aggregated_daily
                UNION ALL
                SELECT school_id, day, daily_energy_kwh FROM live_today
            )
            SELECT 
                d.date,
                COALESCE(SUM(cd.daily_energy_kwh), 0) as total_energy_kwh
            FROM days d
            LEFT JOIN combined_daily cd ON 
                cd.school_id = d.school_id AND 
                cd.day = DATE(d.date)
            GROUP BY d.date
            ORDER BY d.date ASC`,
            [schoolId || null]
        );
        return result.rows.map(row => ({
            date: row.date,
            total_energy_kwh: Number(row.total_energy_kwh)
        }));
    },

    async getFinancialStats(schoolId: string | undefined, schools: any[], currentData: any[], tariff: number, exportTariff: number, carbonFactor: number, defaultIrr: number, timezone: string) {
        // 1. Capex
        const totalCapex = schools.length ? schools.reduce((sum, s) => sum + (Number(s.total_cost_idr) || 0), 0) : 0;

        // 2. Today Savings
        const todaySavings = currentData.reduce((sum, t) => {
            const gen = Number(t.daily_energy_kwh) || 0;
            const exp = Number(t.daily_export_kwh) || 0;
            const selfConsumed = Math.max(0, gen - exp);
            return sum + (selfConsumed * tariff) + (exp * exportTariff);
        }, 0);

        // 3. Month Savings
        const monthStatsResult = await query(
            `WITH school_tz AS (
                SELECT id, timezone as tz FROM public.schools
                WHERE ($1::uuid IS NULL OR id = $1::uuid)
                AND timezone IS NOT NULL
             ),
             -- 1. Aggregated Past Days (Fast)
             agg_history AS (
                SELECT school_id, daily_energy_kwh, daily_export_kwh
                FROM public.telemetry_daily
                WHERE day >= date_trunc('month', NOW() AT TIME ZONE 'Asia/Jakarta') -- Approximation for pruning
                AND ($1::uuid IS NULL OR school_id = $1::uuid)
             ),
             -- 2. Live Today (Real-time)
             live_today AS (
                SELECT 
                    t.school_id, 
                    MAX(t.daily_energy_kwh) - MIN(t.daily_energy_kwh) as daily_energy_kwh, 
                    MAX(t.daily_export_kwh) as daily_export_kwh
                FROM public.telemetry t
                JOIN school_tz s ON t.school_id = s.id
                WHERE t.timestamp >= date_trunc('day', NOW() AT TIME ZONE s.tz)
                AND ($1::uuid IS NULL OR t.school_id = $1::uuid)
                GROUP BY t.school_id
             )
             SELECT 
                COALESCE(SUM(src.daily_energy_kwh), 0) as total_gen, 
                COALESCE(SUM(src.daily_export_kwh), 0) as total_exp
             FROM (
                SELECT daily_energy_kwh, daily_export_kwh FROM agg_history
                UNION ALL
                SELECT daily_energy_kwh, daily_export_kwh FROM live_today
             ) src`,
            [schoolId || null]
        );
        const monthGen = Number(monthStatsResult.rows[0]?.total_gen) || 0;
        const monthExp = Number(monthStatsResult.rows[0]?.total_exp) || 0;
        const monthSelf = Math.max(0, monthGen - monthExp);
        const monthSavings = (monthSelf * tariff) + (monthExp * exportTariff);

        // 4. Lifetime Energy & Savings
        const lifetimeEnergyQuery = schoolId
            ? `SELECT COALESCE(MAX(total_energy_kwh), 0) as total_kwh FROM public.telemetry WHERE school_id = $1`
            : `SELECT COALESCE(SUM(latest_energy), 0) as total_kwh FROM (SELECT DISTINCT ON (school_id) total_energy_kwh as latest_energy FROM public.telemetry ORDER BY school_id, timestamp DESC) sub`;

        const lifetimeEnergyResult = await query(lifetimeEnergyQuery, schoolId ? [schoolId] : []);
        const totalLifetimeEnergy = parseFloat(lifetimeEnergyResult.rows[0]?.total_kwh || '0');
        const totalSavings = totalLifetimeEnergy * tariff; // Approximation

        // 5. Projected Payback & LCOE (Data Driven + Projection)
        // Logic: Annual Savings = (Capacity * AvgYield * 365 * Tariff). 
        // We use actual 30-day yield if available (data driven), otherwise fallback to Nameplate * 3.5 (standard yield).

        const totalCapacity = schools.reduce((sum, s) => sum + (Number(s.total_capacity_kwp) || 0), 0);

        const avgDailyResult = await query(
            `SELECT COALESCE(AVG(daily_max), 0) as avg_gen, COALESCE(AVG(export_max), 0) as avg_exp, COUNT(*) as data_days
             FROM (
                SELECT DATE(t.timestamp AT TIME ZONE s.timezone) as day, MAX(t.daily_energy_kwh) as daily_max, MAX(t.daily_export_kwh) as export_max
                FROM public.telemetry t JOIN public.schools s ON t.school_id = s.id
                WHERE s.deleted_at IS NULL AND s.timezone IS NOT NULL AND t.timestamp >= NOW() - INTERVAL '30 days'
                AND ($1::uuid IS NULL OR t.school_id = $1::uuid)
                GROUP BY day, t.school_id
             ) p`,
            [schoolId || null]
        );

        const dataDays = Number(avgDailyResult.rows[0]?.data_days) || 0;
        let avgDailyGen = Number(avgDailyResult.rows[0]?.avg_gen) || 0;
        let avgDailyExp = Number(avgDailyResult.rows[0]?.avg_exp) || 0;

        // If insufficient data (< 3 days), use Nameplate Projection
        let isProjected = false;
        if (dataDays < 3 && totalCapacity > 0) {
            avgDailyGen = totalCapacity * ENVIRONMENTAL.CONSERVATIVE_YIELD_KWH_PER_KWP;
            avgDailyExp = 0; // Assume 100% self-consumption for conservative payback
            isProjected = true;
        }

        const avgDailySelf = Math.max(0, avgDailyGen - avgDailyExp);
        const dailySavingsProjected = (avgDailySelf * tariff) + (avgDailyExp * exportTariff);
        const annualSavings = dailySavingsProjected * 365;

        // Payback: CAPEX / Annual Savings
        const paybackYears = (totalCapex > 0 && annualSavings > 0) ? totalCapex / annualSavings : 0;

        // LCOE: CAPEX / (Annual Generation * System Lifetime)
        const lifetimeProjectedEnergy = (avgDailyGen * 365 * ENVIRONMENTAL.SOLAR_SYSTEM_LIFETIME_YEARS);
        const lcoe = (totalCapex > 0 && lifetimeProjectedEnergy > 0)
            ? totalCapex / lifetimeProjectedEnergy
            : 0;

        return {
            total_capex_idr: totalCapex,
            total_savings_idr: totalSavings,
            payback_years: parseFloat(paybackYears.toFixed(1)),
            irr_percent: defaultIrr * 100,
            lcoe_idr_per_kwh: lcoe,
            payback_progress_percent: totalCapex > 0 ? Math.min((totalSavings / totalCapex) * 100, 100) : 0,
            today_savings_idr: todaySavings,
            month_savings_idr: monthSavings,
            co2_avoided_kg: totalLifetimeEnergy * carbonFactor,
            trees_planted: (totalLifetimeEnergy * carbonFactor) / ENVIRONMENTAL.CARBON_PER_TREE_KG_YEAR,
            car_km_avoided: (totalLifetimeEnergy * carbonFactor) / ENVIRONMENTAL.CARBON_PER_CAR_KM,
            data_sufficiency: {
                days_observed: dataDays,
                is_projected: isProjected
            }
        };
    },

    async getStorageStats() {
        const storageResult = await query(`SELECT COUNT(*) AS total_points, pg_database_size(current_database()) AS db_size FROM public.telemetry`);
        const storageData = storageResult.rows[0] || { total_points: 0, db_size: 0 };
        return {
            db_engine: STORAGE_METRICS.DB_ENGINE,
            storage_usage_mb: Math.round(parseInt(storageData.db_size) / (1024 * 1024)),
            total_points_stored: parseInt(storageData.total_points),
            compression_ratio: STORAGE_METRICS.COMPRESSION_RATIO, // TODO: Calculate actual
            ingestion_rate_mps: STORAGE_METRICS.INGESTION_RATE_MPS, // TODO: Calculate actual
            retention_policies: {
                raw: `${STORAGE_METRICS.RETENTION_RAW_DAYS} days`,
                aggregated: `${STORAGE_METRICS.RETENTION_AGGREGATED_DAYS} days`
            },
            last_rollup_job: new Date().toISOString(),
        };
    },

    getModelMetrics(alertsCount: number) {
        return {
            version: ML_METRICS.VERSION,
            last_trained: new Date().toISOString(),
            rmse: ML_METRICS.RMSE,
            mape: ML_METRICS.MAPE,
            residuals_trend: ML_METRICS.RESIDUALS_TREND,
            anomaly_detection: {
                precision: ML_METRICS.ANOMALY_PRECISION,
                recall: ML_METRICS.ANOMALY_RECALL,
                f1_score: ML_METRICS.ANOMALY_F1,
                total_anomalies_detected: alertsCount,
            },
        };
    },

    async getLeaderboardStats() {
        const result = await query(
            `WITH daily_yields AS (
                SELECT t.school_id, 
                       DATE(t.timestamp AT TIME ZONE s.timezone) as production_date, 
                       MAX(t.daily_energy_kwh) as day_total
                FROM public.telemetry t
                JOIN public.schools s ON t.school_id = s.id
                WHERE s.timezone IS NOT NULL
                GROUP BY t.school_id, production_date
            ),
            school_aggregates AS (
                SELECT school_id, SUM(day_total) as calculated_total_yield
                FROM daily_yields
                GROUP BY school_id
            ),
            today_metrics AS (
                SELECT school_id, MAX(daily_energy_kwh) - MIN(daily_energy_kwh) as daily_energy_kwh
                FROM public.telemetry
                WHERE timestamp >= CURRENT_DATE
                GROUP BY school_id
            )
            SELECT
                s.id AS school_id, s.name AS school_name, s.district, s.total_capacity_kwp,
                COALESCE(agg.calculated_total_yield, 0) AS total_energy_kwh,
                COALESCE(tm.daily_energy_kwh, 0) AS today_energy_kwh,
                COALESCE(agg.calculated_total_yield * 0.85, 0) AS co2_reduced_kg,
                RANK() OVER(ORDER BY COALESCE(agg.calculated_total_yield, 0) DESC) AS rank
             FROM public.schools s
             LEFT JOIN school_aggregates agg ON s.id = agg.school_id
             LEFT JOIN today_metrics tm ON s.id = tm.school_id
             WHERE s.deleted_at IS NULL
             ORDER BY total_energy_kwh DESC`
        );
        return result.rows;
    }
};
