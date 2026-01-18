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
        const hourlyHistoryResult = await query(
            `WITH hours AS (
                SELECT generate_series(
                    date_trunc('hour', NOW() - INTERVAL '23 hours'),
                    date_trunc('hour', NOW()),
                    '1 hour'::interval
                ) as hour
            )
            SELECT 
                h.hour,
                COALESCE(AVG(t.ac_power_kw), 0) as avg_power,
                COALESCE(MAX(t.daily_energy_kwh), 0) as energy
            FROM hours h
            LEFT JOIN public.telemetry t ON date_trunc('hour', t.timestamp) = h.hour
                ${schoolId ? 'AND t.school_id = $1' : ''}
            GROUP BY h.hour
            ORDER BY h.hour ASC`,
            schoolId ? [schoolId] : []
        );

        const hourly_historical = hourlyHistoryResult.rows.map(row => ({
            hour: row.hour, // Postgres timestamp
            avg_power: Number(row.avg_power),
            energy: Number(row.energy)
        }));

        // 6. Daily History (Last 30 Days) - Standardized Daily
        const dailyHistoryResult = await query(
            `WITH days AS (
                SELECT generate_series(
                    CURRENT_DATE - INTERVAL '29 days',
                    CURRENT_DATE,
                    '1 day'::interval
                ) as date
            )
            SELECT 
                d.date,
                COALESCE(SUM(t.daily_energy_kwh), 0) as total_energy_kwh
            FROM days d
            LEFT JOIN public.telemetry t ON DATE(t.timestamp) = DATE(d.date)
                ${schoolId ? 'AND t.school_id = $1' : ''}
            GROUP BY d.date
            ORDER BY d.date ASC`,
            schoolId ? [schoolId] : []
        );

        const daily_historical = dailyHistoryResult.rows.map(row => ({
            date: row.date,
            total_energy_kwh: Number(row.total_energy_kwh)
        }));

        // Financial stats
        const totalCapex = safeSchools.length ? safeSchools.reduce(
            (sum, s) => sum + (Number(s.total_cost_idr) || 0), 0
        ) : 0;
        const totalEnergy = safeData.length ? safeData.reduce(
            (sum, t) => sum + (parseFloat(t.total_energy_kwh) || 0), 0
        ) : 0;

        const totalSavings = totalEnergy * TARIFF;
        const paybackYears = totalCapex > 0
            ? totalCapex / (totalSavings || 1)
            : 0;

        const financial_stats = {
            total_capex_idr: totalCapex,
            total_savings_idr: totalSavings,
            payback_years: paybackYears,
            irr_percent: DEFAULT_IRR * 100, // Display as percentage
            lcoe_idr_per_kwh: totalEnergy > 0 ? totalCapex / totalEnergy : 0,
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

        const summary: DashboardSummary = {
            schools: safeSchools,
            current_data: safeData,
            alerts: Array.isArray(alerts) ? alerts : [],
            community_stats,

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
                COALESCE(SUM(t.daily_energy_kwh), 0) AS total_energy_kwh,
                COALESCE(SUM(t.daily_energy_kwh) * 0.85, 0) AS co2_reduced_kg,
                ROW_NUMBER() OVER (
                    ORDER BY COALESCE(SUM(t.daily_energy_kwh), 0) DESC
                ) AS rank
             FROM public.schools s
             LEFT JOIN public.telemetry t
                ON s.id = t.school_id
             WHERE s.deleted_at IS NULL
             GROUP BY s.id, s.name
             ORDER BY total_energy_kwh DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Leaderboard error:', error);
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
