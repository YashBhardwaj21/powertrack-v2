import express, { Request, Response } from 'express';
import { query } from '../db/index.js';
import { DashboardSummary, School } from '../types/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { transformSchoolRow } from '../utils/transformers.js';

const router = express.Router();

/* =========================================================
   DASHBOARD SUMMARY
========================================================= */
router.get('/summary', authenticateToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        let schoolId = req.query.school_id as string | undefined;

        // 1️⃣ Backend: Make /dashboard/summary IMPOSSIBLE to crash
        // A. Hard short-circuit at the top of the route
        if (user.role !== 'admin' && !user.school_id) {
            return res.status(200).json({
                needs_school_assignment: true,
                schools: [],
                current_data: [],
                alerts: [],
                community_stats: {
                    active_peers: 0,
                    total_surplus_kw: 0,
                    total_deficit_kw: 0,
                    net_grid_flow_kw: 0,
                    sharing_potential_idr: 0,
                },
                metadata: {
                    electricity_rate_idr: 1500, // DEFAULT TARIFF
                    carbon_intensity_kg_per_kwh: 0.85,
                },
                historical_data: [],
                financial_stats: {
                    total_capex_idr: 0,
                    total_savings_idr: 0,
                    payback_years: 0,
                    irr_percent: 0,
                    lcoe_idr_per_kwh: 0,
                    payback_progress_percent: 0,
                },
                storage_stats: {
                    db_engine: 'PostgreSQL 14',
                    storage_usage_mb: 0,
                    total_points_stored: 0,
                    compression_ratio: 0,
                    ingestion_rate_mps: 0,
                    retention_policies: { raw: '90 days', aggregated: '2 years' },
                    last_rollup_job: new Date().toISOString(),
                },
                model_metrics: {
                    version: '1.0.0',
                    last_trained: new Date().toISOString(),
                    rmse: 0,
                    mape: 0,
                    residuals_trend: [],
                    anomaly_detection: { precision: 0, recall: 0, f1_score: 0, total_anomalies_detected: 0 },
                }
            });
        }

        // Security: Non-admins can only see their own school
        if (user.role !== 'admin') {
            schoolId = user.school_id;

            // 🔒 Guard: If the user is assigned to a school that has been soft-deleted (archived),
            // treat them as unassigned.
            const schoolCheck = await query(
                'SELECT id FROM public.schools WHERE id = $1 AND deleted_at IS NULL',
                [schoolId]
            );

            if (schoolCheck.rows.length === 0) {
                // School is gone. Force "Needs Assignment" response.
                return res.status(200).json({
                    needs_school_assignment: true,
                    schools: [],
                    current_data: [],
                    alerts: [],
                    // ... (rest of empty state)
                    community_stats: { active_peers: 0, total_surplus_kw: 0, total_deficit_kw: 0, net_grid_flow_kw: 0, sharing_potential_idr: 0 },
                    metadata: { electricity_rate_idr: 1500, carbon_intensity_kg_per_kwh: 0.85 },
                    historical_data: [],
                    financial_stats: { total_capex_idr: 0, total_savings_idr: 0, payback_years: 0, irr_percent: 0, lcoe_idr_per_kwh: 0, payback_progress_percent: 0 },
                    storage_stats: { db_engine: 'PostgreSQL 14', storage_usage_mb: 0, total_points_stored: 0, compression_ratio: 0, ingestion_rate_mps: 0, retention_policies: { raw: '90 days', aggregated: '2 years' }, last_rollup_job: new Date().toISOString() },
                    model_metrics: { version: '1.0.0', last_trained: new Date().toISOString(), rmse: 0, mape: 0, residuals_trend: [], anomaly_detection: { precision: 0, recall: 0, f1_score: 0, total_anomalies_detected: 0 } }
                });
            }
        }

        // 1. Fetch System Parameters
        const paramsResult = await query(
            'SELECT * FROM public.system_parameters WHERE key IN ($1, $2, $3)',
            ['electricity_rate_idr', 'carbon_factor_kg_per_kwh', 'default_irr_percent']
        );

        // Defaults if DB is empty (Fallbacks)
        let TARIFF = 1444.7; // IDR per kWh
        let CARBON_FACTOR = 0.85; // kgCO2 per kWh
        let DEFAULT_IRR = 0.125; // 12.5%

        paramsResult.rows.forEach(p => {
            if (p.key === 'electricity_rate_idr') TARIFF = parseFloat(p.value);
            // Handle both legacy key names if needed, prompt said 'carbon_factor_kg_per_kwh'
            if (p.key === 'carbon_intensity_kg_per_kwh' || p.key === 'carbon_factor_kg_per_kwh') CARBON_FACTOR = parseFloat(p.value);
            if (p.key === 'default_irr_percent') DEFAULT_IRR = parseFloat(p.value);
        });

        // 2. Get all active schools - Direct query to avoid view fragility
        const schoolsResult = await query(
            'SELECT * FROM public.schools WHERE deleted_at IS NULL ORDER BY name'
        );

        // 1b. Backend Normalization: Map flat DB fields to nested coordinates for Frontend
        // Filter out any nulls from transformation
        const schools = schoolsResult.rows
            .map(transformSchoolRow)
            .filter((s): s is School => s !== null);

        // 3. Latest telemetry per active school
        // SQL Injection protection and parameter consistency
        const telemetryQuery = schoolId
            ? `SELECT DISTINCT ON (school_id) *
               FROM public.telemetry
               WHERE school_id = $1
               ORDER BY school_id, timestamp DESC`
            : `SELECT DISTINCT ON (t.school_id) t.*
               FROM public.telemetry t
               JOIN public.schools s ON t.school_id = s.id
               WHERE s.deleted_at IS NULL
               ORDER BY t.school_id, t.timestamp DESC`;

        const telemetryResult = await query(telemetryQuery, schoolId ? [schoolId] : []);
        const current_data = telemetryResult.rows;

        // Unresolved alerts - Remove active_schools view dependency
        const alertsQuery = schoolId
            ? `SELECT a.*, s.name AS school_name
               FROM public.alerts a
               JOIN public.schools s ON a.school_id = s.id
               WHERE a.resolved = FALSE AND a.school_id = $1 AND s.deleted_at IS NULL
               ORDER BY a.timestamp DESC
               LIMIT 50`
            : `SELECT a.*, s.name AS school_name
               FROM public.alerts a
               JOIN public.schools s ON a.school_id = s.id
               WHERE a.resolved = FALSE AND s.deleted_at IS NULL
               ORDER BY a.timestamp DESC
               LIMIT 50`;

        const alertsResult = await query(alertsQuery, schoolId ? [schoolId] : []);
        const alerts = alertsResult.rows;

        // B. Never call reduce/map without a default
        const safeData = Array.isArray(current_data) ? current_data : [];
        const safeSchools = Array.isArray(schools) ? schools : [];

        // Community stats
        const totalPower = safeData.length ? safeData.reduce(
            (sum, t) => sum + (Number(t.ac_power_kw) || 0), 0
        ) : 0;
        const totalLoad = safeData.length ? safeData.reduce(
            (sum, t) => sum + (Number(t.load_kw) || 0), 0
        ) : 0;
        const totalExport = safeData.length ? safeData.reduce(
            (sum, t) => sum + (Number(t.grid_export_kw) || 0), 0
        ) : 0;
        const totalImport = safeData.length ? safeData.reduce(
            (sum, t) => sum + (Number(t.grid_import_kw) || 0), 0
        ) : 0;

        const community_stats = {
            active_peers: safeData.length,
            total_surplus_kw: totalExport,
            total_deficit_kw: totalImport,
            net_grid_flow_kw: totalExport - totalImport,
            sharing_potential_idr: (totalExport - totalImport) * TARIFF,
        };

        // 5. Energy generation trend (Last 24h) - Standardized Hourly
        // 5. Energy generation trend - Timezone Aware
        // Default timezone if not specific school or if school has no timezone: UTC
        // But if schoolId provided, fetch its timezone.
        let schoolTimezone = 'UTC';
        if (schoolId) {
            const schoolResult = await query('SELECT timezone FROM public.schools WHERE id = $1', [schoolId]);
            if (schoolResult.rows.length > 0) {
                schoolTimezone = schoolResult.rows[0].timezone || 'UTC';
            }
        } else if (safeSchools.length > 0) {
            // For "All Schools", we might default to the first authorized school's TZ or keep UTC.
            // Best practice for aggregates: UTC. But user wants specific time.
            // Let's stick to UTC for aggregate view unless a specific school is filtered.
            schoolTimezone = 'UTC';
        }

        const granularity = req.query.granularity === '15min' ? '15 minutes' : '1 hour';
        const interval = req.query.granularity === '15min' ? '15 minutes' : '1 hour';

        // Hourly: Anchor to School's "Now"
        const hourlyHistoryResult = await query(
            `WITH time_buckets AS (
                SELECT generate_series(
                    date_trunc('hour', NOW() AT TIME ZONE $2 - INTERVAL '24 hours'), 
                    date_trunc('minute', NOW() AT TIME ZONE $2), 
                    $1::interval
                ) as time_bucket
            ),
            per_school_hourly AS (
                SELECT 
                    tb.time_bucket,
                    t.school_id,
                    AVG(t.ac_power_kw) as school_avg_power,
                    AVG(t.load_kw) as school_avg_load,
                    AVG(t.grid_import_kw) as school_avg_import,
                    AVG(t.grid_export_kw) as school_avg_export,
                    MAX(t.total_energy_kwh) as school_max_energy
                FROM time_buckets tb
                LEFT JOIN public.telemetry t ON 
                    date_trunc('minute', t.timestamp AT TIME ZONE $2) >= tb.time_bucket 
                    AND t.timestamp AT TIME ZONE $2 < tb.time_bucket + $1::interval
                    ${schoolId ? 'AND t.school_id = $3' : ''}
                GROUP BY tb.time_bucket, t.school_id
            )
            SELECT 
                tb.time_bucket as hour,
                COALESCE(SUM(p.school_avg_power), 0) as avg_power,
                COALESCE(SUM(p.school_max_energy), 0) as energy,
                COALESCE(SUM(p.school_avg_load), 0) as avg_load,
                COALESCE(SUM(p.school_avg_import), 0) as avg_import,
                COALESCE(SUM(p.school_avg_export), 0) as avg_export
            FROM time_buckets tb
            LEFT JOIN per_school_hourly p ON tb.time_bucket = p.time_bucket
            GROUP BY tb.time_bucket
            ORDER BY tb.time_bucket ASC`,
            schoolId ? [interval, schoolTimezone, schoolId] : [interval, schoolTimezone]
        );

        const hourly_historical = hourlyHistoryResult.rows.map(row => ({
            hour: row.hour,
            avg_power: Number(row.avg_power),
            energy: Number(row.energy),
            avg_load: Number(row.avg_load),
            avg_import: Number(row.avg_import),
            avg_export: Number(row.avg_export)
        }));

        // 6. Daily History - Timezone Aware (The prompt's main request)
        const dailyHistoryResult = await query(
            `WITH days AS (
                SELECT generate_series(
                    (DATE(NOW() AT TIME ZONE $1) - INTERVAL '29 days')::timestamp, 
                    DATE(NOW() AT TIME ZONE $1)::timestamp,
                    '1 day'::interval
                ) as date
            ),
            per_school_daily AS (
                SELECT 
                    d.date,
                    t.school_id,
                    SUM(t.daily_energy_kwh) as school_day_max
                FROM days d
                LEFT JOIN public.telemetry t ON 
                    DATE(t.timestamp AT TIME ZONE $1) = DATE(d.date)
                    ${schoolId ? 'AND t.school_id = $2' : ''}
                GROUP BY d.date, t.school_id
            )
            SELECT 
                d.date,
                COALESCE(SUM(p.school_day_max), 0) as total_energy_kwh
            FROM days d
            LEFT JOIN per_school_daily p ON d.date = p.date
            GROUP BY d.date
            ORDER BY d.date ASC`,
            schoolId ? [schoolTimezone, schoolId] : [schoolTimezone]
        );

        const daily_historical = dailyHistoryResult.rows.map(row => ({
            date: row.date,
            total_energy_kwh: Number(row.total_energy_kwh)
        }));

        // Financial stats
        const totalCapex = safeSchools.length ? safeSchools.reduce(
            (sum, s) => sum + (Number(s.total_cost_idr) || 0), 0
        ) : 0;
        // 6b. Correctly Calculate Total Energy (Lifetime)
        // Query the latest total_energy_kwh from telemetry for each school and sum them.
        const lifetimeEnergyQuery = schoolId
            ? `SELECT COALESCE(MAX(total_energy_kwh), 0) as total_kwh 
               FROM public.telemetry 
               WHERE school_id = $1`
            : `SELECT COALESCE(SUM(latest_energy), 0) as total_kwh 
               FROM (
                   SELECT DISTINCT ON (school_id) total_energy_kwh as latest_energy
                   FROM public.telemetry
                   ORDER BY school_id, timestamp DESC
               ) sub`;

        const lifetimeEnergyResult = await query(lifetimeEnergyQuery, schoolId ? [schoolId] : []);
        const totalLifetimeEnergy = parseFloat(lifetimeEnergyResult.rows[0]?.total_kwh || '0');

        const totalSavings = totalLifetimeEnergy * TARIFF;

        // Payback Calculation: Estimate Annual Savings
        // 1. Get average daily energy from last 30 days
        const avgDailyEnergyResult = await query(
            `SELECT COALESCE(AVG(p.school_day_max), 0) as avg_daily_kwh
             FROM (
                SELECT DATE(t.timestamp AT TIME ZONE $1) as day, SUM(t.daily_energy_kwh) as school_day_max
                FROM public.telemetry t
                JOIN public.schools s ON t.school_id = s.id
                WHERE s.deleted_at IS NULL
                  AND t.timestamp >= NOW() - INTERVAL '30 days'
                  ${schoolId ? 'AND t.school_id = $2' : ''}
                GROUP BY day, t.school_id
             ) p`,
            schoolId ? [schoolTimezone, schoolId] : [schoolTimezone]
        );

        const avgDailyKwh = parseFloat(avgDailyEnergyResult.rows[0]?.avg_daily_kwh || '0');
        const annualSavings = avgDailyKwh * 365 * TARIFF;

        const paybackYears = (totalCapex > 0 && annualSavings > 0)
            ? totalCapex / annualSavings
            : 0;

        const financial_stats = {
            total_capex_idr: totalCapex,
            total_savings_idr: totalSavings,
            payback_years: paybackYears,
            irr_percent: DEFAULT_IRR * 100,
            lcoe_idr_per_kwh: totalLifetimeEnergy > 0 ? totalCapex / totalLifetimeEnergy : 0,
            payback_progress_percent:
                totalCapex > 0
                    ? Math.min((totalSavings / totalCapex) * 100, 100)
                    : 0,
        };

        // Storage stats
        const storageResult = await query(
            `SELECT
                COUNT(*) AS total_points,
                pg_database_size(current_database()) AS db_size
             FROM public.telemetry`
        );
        const storageData = storageResult.rows[0] || { total_points: 0, db_size: 0 };

        const storage_stats = {
            db_engine: 'PostgreSQL 14 (Partitioned)',
            storage_usage_mb: Math.round(
                parseInt(storageData.db_size) / (1024 * 1024)
            ),
            total_points_stored: parseInt(storageData.total_points),
            compression_ratio: 3.2,
            ingestion_rate_mps: 0.5,
            retention_policies: {
                raw: '90 days',
                aggregated: '2 years',
            },
            last_rollup_job: new Date().toISOString(),
        };

        // Model metrics (placeholder)
        const model_metrics = {
            version: '1.0.0',
            last_trained: new Date().toISOString(),
            rmse: 0.15,
            mape: 5.2,
            residuals_trend: [0.1, 0.05, -0.02, 0.03, -0.01],
            anomaly_detection: {
                precision: 0.92,
                recall: 0.88,
                f1_score: 0.90,
                total_anomalies_detected: alerts.length,
            },
        };

        // 7. Get Aggregated Leaderboard Stats (Matching Public Lobby Logic)
        // 7. Get Aggregated Leaderboard Stats (Matching Public Lobby Logic)
        const leaderboardResult = await query(
            `SELECT
                s.id AS school_id,
                s.name AS school_name,
                s.district, -- Added for map visualization
                COALESCE(SUM(t.daily_energy_kwh), 0) AS total_energy_kwh,
                COALESCE(SUM(t.daily_energy_kwh) * 0.85, 0) AS co2_reduced_kg,
                RANK() OVER (
                    ORDER BY COALESCE(SUM(t.daily_energy_kwh), 0) DESC
                ) AS rank
             FROM public.schools s
             LEFT JOIN public.telemetry t
                ON s.id = t.school_id
             WHERE s.deleted_at IS NULL
             GROUP BY s.id, s.name, s.district
             ORDER BY rank ASC`
        );
        const leaderboard_stats = leaderboardResult.rows;

        const summary: DashboardSummary = {
            schools: safeSchools,
            current_data: safeData,
            alerts: Array.isArray(alerts) ? alerts : [],
            community_stats,
            leaderboard_stats, // Include the aggregated stats

            metadata: {
                electricity_rate_idr: TARIFF,
                carbon_intensity_kg_per_kwh: CARBON_FACTOR,
            },
            daily_historical,
            hourly_historical,
            // Deprecated: existing frontend might rely on this, mapping to daily for now or empty?
            // The prompt says "daily_historical: [{ date... }], hourly_historical: [{ hour... }]"
            // But checking types.ts (backend) I marked it deprecated.
            // Let's populate it with daily data to be safe or empty if not needed. 
            // The prompt didn't strictly say to remove it, just "Make backend & frontend types match". 
            // I'll map daily to it for backward compat just in case.
            historical_data: daily_historical,
            financial_stats,
            storage_stats,
            model_metrics,
        };

        res.json(summary);
    } catch (error) {
        console.error('Dashboard summary error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/* =========================================================
   PUBLIC LEADERBOARD
========================================================= */
router.get('/leaderboard', async (_req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT
                s.id AS school_id,
                s.name AS school_name,
                s.district,
                COALESCE(SUM(t.daily_energy_kwh), 0) AS total_energy_kwh,
                --We still calculate rough CO2 here for sorting if needed, but client should use metadata
                COALESCE(SUM(t.daily_energy_kwh) * 0.85, 0) AS co2_reduced_kg,
                RANK() OVER(
                    ORDER BY COALESCE(SUM(t.daily_energy_kwh), 0) DESC
                ) AS rank
             FROM public.schools s
             LEFT JOIN public.telemetry t
                ON s.id = t.school_id
             WHERE s.deleted_at IS NULL
             GROUP BY s.id, s.name, s.district
             ORDER BY total_energy_kwh DESC`
        );

        // Fetch System Parameters for Dynamic Frontend logic
        const paramsResult = await query(
            'SELECT * FROM public.system_parameters WHERE key IN ($1, $2)',
            ['electricity_rate_idr', 'carbon_intensity_kg_per_kwh']
        );

        let carbonFactor = 0.85;
        let currencyRate = 1444.7;

        paramsResult.rows.forEach(p => {
            if (p.key === 'carbon_intensity_kg_per_kwh') carbonFactor = parseFloat(p.value);
            if (p.key === 'electricity_rate_idr') currencyRate = parseFloat(p.value);
        });

        res.json({
            leaderboard: result.rows,
            metadata: {
                carbon_intensity_kg_per_kwh: carbonFactor,
                electricity_rate_idr: currencyRate
            }
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/* =========================================================
   PUBLIC METRICS (Graph Data)
========================================================= */
router.get('/public-metrics', async (req: Request, res: Response) => {
    try {
        // Default to 15min
        const interval = '15 minutes';

        // Fetch raw data grouped by time bucket and school
        const historyResult = await query(
            `WITH time_buckets AS(
                SELECT generate_series(
                    --Anchor to the exact current time minus 24h, creating buckets
                    date_trunc('minute', NOW() - INTERVAL '24 hours'),
                    date_trunc('minute', NOW()),
                    $1:: interval
                ) as time_bucket
            )
        SELECT
        tb.time_bucket as timestamp,
            s.name as school_name,
            COALESCE(AVG(t.ac_power_kw), 0) as avg_power
            FROM time_buckets tb
            CROSS JOIN public.schools s 
            LEFT JOIN public.telemetry t ON
        t.school_id = s.id AND
        date_trunc('minute', t.timestamp) >= tb.time_bucket AND
        t.timestamp < tb.time_bucket + $1:: interval
            WHERE s.deleted_at IS NULL
            GROUP BY tb.time_bucket, s.name
            ORDER BY tb.time_bucket ASC, s.name ASC`,
            [interval]
        );

        // Pivot in memory: Array of { timestamp, "School A": 10, "School B": 20 }
        const pivotedMap = new Map<string, any>();

        historyResult.rows.forEach(row => {
            const timeKey = row.timestamp.toISOString(); // Use standard ISO string

            if (!pivotedMap.has(timeKey)) {
                pivotedMap.set(timeKey, { timestamp: timeKey });
            }

            const entry = pivotedMap.get(timeKey);
            entry[row.school_name] = Number(row.avg_power);
        });

        const data = Array.from(pivotedMap.values());

        res.json(data);
    } catch (error) {
        console.error('Public metrics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/* =========================================================
   ENERGY LOGS
========================================================= */
router.get('/energy-logs', authenticateToken, async (req: Request, res: Response) => {
    try {
        let schoolId = req.query.school_id as string;
        const limit = parseInt(req.query.limit as string) || 50;
        const user = (req as any).user;

        // Security: Non-admins can only see their own school
        if (user.role !== 'admin') {
            schoolId = user.school_id;
        }

        if (!schoolId) {
            return res.status(400).json({ error: 'school_id parameter required' });
        }

        const result = await query(
            `SELECT
        school_id,
            timestamp AS created_at,
                ac_power_kw * 1000 AS power_w,
                    ac_voltage AS voltage,
                        ac_current AS current_a,
                            daily_energy_kwh AS daily_kwh
             FROM public.telemetry
             WHERE school_id = $1
             ORDER BY timestamp DESC
             LIMIT $2`,
            [schoolId, limit]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Energy logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
