import express, { Request, Response } from 'express';
import { query } from '../db/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { validateUUID } from '../middleware/validateUUID.js';
import { dashboardService } from '../services/dashboardService.js';
import { BUSINESS_LOGIC } from '../config/constants.js';
import { DashboardSummary } from '../types/index.js';

const router = express.Router();

/* =========================================================
   DASHBOARD SUMMARY (Refactored)
========================================================= */
router.get('/summary', authenticateToken, validateUUID('school_id'), async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        let schoolId = req.query.school_id as string | undefined;

        // 1. Security & Context
        if (user.role !== 'admin') {
            schoolId = user.school_id;
            const schoolCheck = await query('SELECT id FROM public.schools WHERE id = $1 AND deleted_at IS NULL', [schoolId]);
            if (schoolCheck.rows.length === 0) {
                return res.json({ needs_school_assignment: true, schools: [], current_data: [], alerts: [], historical_data: [], community_stats: {}, financial_stats: {}, storage_stats: {}, model_metrics: {} });
            }
        } else if (!user.school_id && !schoolId) {
            // Admin with no specific view
            return res.json({ needs_school_assignment: true, schools: [], current_data: [], alerts: [], historical_data: [], community_stats: {}, financial_stats: {}, storage_stats: {}, model_metrics: {} });
        }



        // 2. Fetch System Params & Config (Fast)
        const params = await dashboardService.getSystemParams(['electricity_rate_idr', 'carbon_intensity_kg_per_kwh', 'default_irr_percent', 'feed_in_tariff_idr']);
        const TARIFF = params?.electricity_rate_idr || BUSINESS_LOGIC.DEFAULT_ELECTRICITY_RATE_IDR;
        const CARBON_FACTOR = params?.carbon_intensity_kg_per_kwh || BUSINESS_LOGIC.DEFAULT_CARBON_INTENSITY_KG;
        const DEFAULT_IRR = params?.default_irr_percent || BUSINESS_LOGIC.DEFAULT_IRR_PERCENT;
        const EXPORT_TARIFF = params?.feed_in_tariff_idr || BUSINESS_LOGIC.DEFAULT_FEED_IN_TARIFF_IDR;

        // 3. Parallel Data Fetching (Crash Immunity)
        const granularity = req.query.granularity === '15min' ? '15 minutes' : '1 hour';

        const [
            schoolsResult,
            telemetryResult,
            alertsResult,
            hourlyHistoryResult,
            dailyHistoryResult,
            storageResult,
            leaderboardResult
        ] = await Promise.allSettled([
            dashboardService.getActiveSchools(),
            dashboardService.getCurrentTelemetry(schoolId),
            dashboardService.getAlerts(schoolId),
            dashboardService.getHourlyHistory(schoolId, granularity),
            dashboardService.getDailyHistory(schoolId),
            dashboardService.getStorageStats(),
            dashboardService.getLeaderboardStats()
        ]);

        // Helper to unwrap settled promises safely
        const unwrap = <T>(result: PromiseSettledResult<T>, fallback: T): T =>
            result.status === 'fulfilled' ? result.value : fallback;

        const schools = unwrap(schoolsResult, []);
        const current_data = unwrap(telemetryResult, []);
        const alerts = unwrap(alertsResult, []);
        const hourly_historical = unwrap(hourlyHistoryResult, []);
        const daily_historical = unwrap(dailyHistoryResult, []);
        const storage_stats = unwrap(storageResult, {
            db_engine: 'PostgreSQL', storage_usage_mb: 0, total_points_stored: 0, compression_ratio: 0, ingestion_rate_mps: 0, retention_policies: { raw: 'N/A', aggregated: 'N/A' }, last_rollup_job: new Date().toISOString()
        });
        const leaderboard_stats = unwrap(leaderboardResult, []);

        // 4. Derived Calculations (Safe from crash)
        const defaultCommunityStats = { active_peers: 0, total_surplus_kw: 0, total_deficit_kw: 0, net_grid_flow_kw: 0, sharing_potential_idr: 0 };
        const defaultFinancialStats = { total_capex_idr: 0, total_savings_idr: 0, payback_years: 0, irr_percent: 0, lcoe_idr_per_kwh: 0, payback_progress_percent: 0, today_savings_idr: 0, month_savings_idr: 0, co2_avoided_kg: 0, trees_planted: 0, car_km_avoided: 0 };
        const defaultModelMetrics = { version: '1.0.0', last_trained: new Date().toISOString(), rmse: 0, mape: 0, residuals_trend: [] as number[], anomaly_detection: { precision: 0, recall: 0, f1_score: 0, total_anomalies_detected: 0 } };

        let community_stats = defaultCommunityStats;
        let financial_stats = defaultFinancialStats; // Type 'any' temporarily if interface doesn't match perfectly or fix interface usage
        let model_metrics = defaultModelMetrics;

        try {
            community_stats = dashboardService.calculateCommunityStats(current_data, TARIFF);
            // Cast to any if partial match issues, but service returns full object.
            // Cast to any if partial match issues, but service returns full object.
            financial_stats = await dashboardService.getFinancialStats(schoolId, schools, current_data, TARIFF, EXPORT_TARIFF, CARBON_FACTOR, DEFAULT_IRR, 'Asia/Jakarta') as any; // Fallback, service uses DB timezone now
            model_metrics = dashboardService.getModelMetrics(alerts.length);
        } catch (calcError) {
            console.error('Error calculating derived stats:', calcError);
            // Return empty/safe objects so dash loads partially
        }

        const summary: DashboardSummary = {
            schools,
            current_data,
            alerts,
            community_stats,
            leaderboard_stats,
            metadata: {
                electricity_rate_idr: TARIFF,
                carbon_intensity_kg_per_kwh: CARBON_FACTOR,
                school_timezone: schools.find(s => s.id === schoolId)?.timezone || 'Asia/Jakarta',
            },
            hourly_historical,
            historical_data: daily_historical, // Back-compat
            daily_historical,
            financial_stats,
            storage_stats,
            model_metrics,
        };

        res.json(summary);

    } catch (error) {
        console.error('Dashboard fatal error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/* =========================================================
   PUBLIC LEADERBOARD
========================================================= */
router.get('/leaderboard', async (_req: Request, res: Response) => {
    try {
        const [leaderboard, params] = await Promise.all([
            dashboardService.getLeaderboardStats(),
            dashboardService.getSystemParams(['electricity_rate_idr', 'carbon_intensity_kg_per_kwh'])
        ]);

        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.json({
            leaderboard,
            metadata: {
                carbon_intensity_kg_per_kwh: params?.carbon_intensity_kg_per_kwh || 0.85,
                electricity_rate_idr: params?.electricity_rate_idr || 1500
            }
        });
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/* =========================================================
   HOURLY HISTORY (For Interactive Charts)
   GET /dashboard/hourly?date=2024-01-01
========================================================= */
router.get('/hourly', authenticateToken, validateUUID('school_id'), async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        let schoolId = req.query.school_id as string | undefined;
        const date = req.query.date as string | undefined;

        if (user.role !== 'admin') {
            schoolId = user.school_id;
        }

        const granularity = '1 hour'; // Or 15 min if you prefer
        const hourlyStats = await dashboardService.getHourlyHistory(schoolId, granularity, date);

        res.json(hourlyStats);
    } catch (error) {
        console.error('Hourly history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Re-export other existing routes (Public Metrics, Energy Logs, Analytics) 
// ... (For brevity, I will copy them back or import if they were separate. 
// Since I am replacing the file, I MUST include them or they will be lost.
// I will include the remaining routes from the original file below.)

/* =========================================================
   PUBLIC METRICS (Graph Data)
========================================================= */
router.get('/public-metrics', async (req: Request, res: Response) => {
    // ... (Keeping original implementation for now, it's independent)
    try {
        const interval = '15 minutes';
        const historyResult = await query(
            `WITH time_buckets AS(SELECT generate_series(date_trunc('minute', NOW() - INTERVAL '24 hours'), date_trunc('minute', NOW()), $1:: interval) as time_bucket)
            SELECT tb.time_bucket as timestamp, s.name as school_name, COALESCE(AVG(t.ac_power_kw), 0) as avg_power
            FROM time_buckets tb CROSS JOIN public.schools s 
            LEFT JOIN public.telemetry t ON t.school_id = s.id AND date_trunc('minute', t.timestamp) >= tb.time_bucket AND t.timestamp < tb.time_bucket + $1:: interval
            WHERE s.deleted_at IS NULL
            GROUP BY tb.time_bucket, s.name ORDER BY tb.time_bucket ASC, s.name ASC`,
            [interval]
        );

        const pivotedMap = new Map<string, any>();
        historyResult.rows.forEach(row => {
            const timeKey = row.timestamp.toISOString();
            if (!pivotedMap.has(timeKey)) pivotedMap.set(timeKey, { timestamp: timeKey });
            const entry = pivotedMap.get(timeKey);
            entry[row.school_name] = Number(row.avg_power);
        });

        res.json(Array.from(pivotedMap.values()));
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
        if (user.role !== 'admin') schoolId = user.school_id;
        if (!schoolId) return res.status(400).json({ error: 'school_id parameter required' });

        const result = await query(
            `SELECT school_id, timestamp AS created_at, ac_power_kw * 1000 AS power_w, ac_voltage AS voltage, ac_current AS current_a, daily_energy_kwh AS daily_kwh
             FROM public.telemetry WHERE school_id = $1 ORDER BY timestamp DESC LIMIT $2`,
            [schoolId, limit]
        );
        res.json(result.rows);
    } catch (error) {
        console.error('Energy logs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/* =========================================================
   ANALYTICS (CUSTOM RANGE)
========================================================= */
router.get('/analytics', authenticateToken, async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        let schoolId = req.query.school_id as string | undefined;
        if (user.role !== 'admin') schoolId = user.school_id;

        const end = req.query.end ? new Date(req.query.end as string) : new Date();
        const start = req.query.start ? new Date(req.query.start as string) : new Date(new Date().setDate(end.getDate() - 30));


        const historyResult = await query(
            `WITH days AS (SELECT generate_series($1::timestamp, $2::timestamp, '1 day'::interval) as date),
            per_school_daily AS (
                SELECT DATE(t.timestamp AT TIME ZONE COALESCE(s.timezone, 'Asia/Jakarta')) as date_key, MAX(t.daily_energy_kwh) - MIN(t.daily_energy_kwh) as daily_energy, MAX(t.ac_power_kw) as peak_power
                FROM public.telemetry t
                JOIN public.schools s ON t.school_id = s.id
                WHERE t.timestamp >= $1 AND t.timestamp <= $2 ${schoolId ? 'AND t.school_id = $3' : ''}
                GROUP BY date_key
            )
            SELECT d.date, COALESCE(p.daily_energy, 0) as total_energy_kwh, COALESCE(p.peak_power, 0) as peak_power_kw
            FROM days d LEFT JOIN per_school_daily p ON DATE(d.date) = p.date_key ORDER BY d.date ASC`,
            schoolId ? [start, end, schoolId] : [start, end]
        );

        const statsResult = await query(
            `WITH daily_maxes AS (
                SELECT DATE(t.timestamp AT TIME ZONE COALESCE(s.timezone, 'Asia/Jakarta')) as day, t.school_id, MAX(t.daily_energy_kwh) as day_energy 
                FROM public.telemetry t
                JOIN public.schools s ON t.school_id = s.id
                WHERE t.timestamp >= $1 AND t.timestamp <= $2 ${schoolId ? 'AND t.school_id = $3' : ''} 
                GROUP BY day, t.school_id
             )
             SELECT COALESCE(SUM(day_energy), 0) as period_energy,
                (SELECT COALESCE(MAX(ac_power_kw), 0) FROM public.telemetry t WHERE t.timestamp >= $1 AND t.timestamp <= $2 ${schoolId ? 'AND t.school_id = $3' : ''}) as max_power,
                (SELECT COALESCE(AVG(ac_power_kw), 0) FROM public.telemetry t WHERE t.timestamp >= $1 AND t.timestamp <= $2 ${schoolId ? 'AND t.school_id = $3' : ''}) as avg_power
             FROM daily_maxes`,
            schoolId ? [start, end, schoolId] : [start, end]
        );

        const stats = statsResult.rows[0];
        res.json({
            range: { start, end },
            daily_series: historyResult.rows.map(r => ({ date: r.date, total_energy_kwh: Number(r.total_energy_kwh), peak_power_kw: Number(r.peak_power_kw) })),
            stats: { total_energy_kwh: Number(stats.period_energy) || 0, peak_power_kw: Number(stats.max_power) || 0, avg_power_kw: Number(stats.avg_power) || 0 }
        });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
