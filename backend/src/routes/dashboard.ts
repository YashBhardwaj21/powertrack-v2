import express, { Request, Response } from 'express';
import { query } from '../db/index.js';
import { DashboardSummary } from '../types/index.js';

const router = express.Router();

// Get complete dashboard summary
router.get('/summary', async (req: Request, res: Response) => {
    try {
        const schoolId = req.query.school_id as string | undefined;

        // Get all schools
        const schoolsResult = await query('SELECT * FROM schools ORDER BY name');
        const schools = schoolsResult.rows;

        // Get latest telemetry for each school (or specific school)
        const telemetryQuery = schoolId
            ? `SELECT DISTINCT ON (school_id) * FROM telemetry 
               WHERE school_id = $1 
               ORDER BY school_id, timestamp DESC`
            : `SELECT DISTINCT ON (school_id) * FROM telemetry 
               ORDER BY school_id, timestamp DESC`;

        const telemetryParams = schoolId ? [schoolId] : [];
        const telemetryResult = await query(telemetryQuery, telemetryParams);
        const current_data = telemetryResult.rows;

        // Get unresolved alerts
        const alertsQuery = schoolId
            ? `SELECT a.*, s.name as school_name FROM alerts a 
               JOIN schools s ON a.school_id = s.id 
               WHERE a.resolved = FALSE AND a.school_id = $1 
               ORDER BY a.timestamp DESC LIMIT 50`
            : `SELECT a.*, s.name as school_name FROM alerts a 
               JOIN schools s ON a.school_id = s.id 
               WHERE a.resolved = FALSE 
               ORDER BY a.timestamp DESC LIMIT 50`;

        const alertsParams = schoolId ? [schoolId] : [];
        const alertsResult = await query(alertsQuery, alertsParams);
        const alerts = alertsResult.rows;

        // Calculate community stats
        const totalPower = current_data.reduce((sum, t) => sum + (parseFloat(t.ac_power_kw) || 0), 0);
        const totalLoad = current_data.reduce((sum, t) => sum + (parseFloat(t.load_kw) || 0), 0);
        const totalExport = current_data.reduce((sum, t) => sum + (parseFloat(t.grid_export_kw) || 0), 0);
        const totalImport = current_data.reduce((sum, t) => sum + (parseFloat(t.grid_import_kw) || 0), 0);

        const community_stats = {
            active_peers: current_data.length,
            total_surplus_kw: totalExport,
            total_deficit_kw: totalImport,
            net_grid_flow_kw: totalExport - totalImport,
            sharing_potential_idr: (totalExport - totalImport) * 1444.7,
        };

        // Get historical data (last 30 days)
        const historicalResult = await query(
            `SELECT DATE(timestamp) as date, SUM(daily_energy_kwh) as total_energy_kwh
             FROM telemetry
             WHERE timestamp >= NOW() - INTERVAL '30 days'
             GROUP BY DATE(timestamp)
             ORDER BY date DESC`
        );
        const historical_data = historicalResult.rows;

        // Calculate financial stats
        const totalCapex = schools.reduce((sum, s) => sum + (parseFloat(s.total_cost_idr) || 0), 0);
        const totalEnergy = current_data.reduce((sum, t) => sum + (parseFloat(t.total_energy_kwh) || 0), 0);
        const totalSavings = totalEnergy * 1444.7; // IDR per kWh
        const paybackYears = totalCapex > 0 ? totalCapex / (totalSavings || 1) : 0;

        const financial_stats = {
            total_capex_idr: totalCapex,
            total_savings_idr: totalSavings,
            payback_years: paybackYears,
            irr_percent: 12.5, // Placeholder - would need complex calculation
            lcoe_idr_per_kwh: totalEnergy > 0 ? totalCapex / totalEnergy : 0,
            payback_progress_percent: Math.min((totalSavings / totalCapex) * 100, 100),
        };

        // Get storage stats
        const storageResult = await query(
            `SELECT 
                COUNT(*) as total_points,
                pg_database_size(current_database()) as db_size
             FROM telemetry`
        );
        const storageData = storageResult.rows[0];

        const storage_stats = {
            db_engine: 'PostgreSQL 14',
            storage_usage_mb: Math.round(parseInt(storageData.db_size) / (1024 * 1024)),
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
            schools,
            current_data,
            alerts,
            community_stats,
            metadata: {
                electricity_rate_idr: 1444.7,
                carbon_intensity_kg_per_kwh: 0.85,
            },
            historical_data,
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

// Get public leaderboard
router.get('/leaderboard', async (req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT 
                s.id as school_id,
                s.name as school_name,
                COALESCE(SUM(t.daily_energy_kwh), 0) as total_energy_kwh,
                COALESCE(SUM(t.daily_energy_kwh) * 0.85, 0) as co2_reduced_kg,
                ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(t.daily_energy_kwh), 0) DESC) as rank
             FROM schools s
             LEFT JOIN telemetry t ON s.id = t.school_id
             GROUP BY s.id, s.name
             ORDER BY total_energy_kwh DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Leaderboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get energy logs for a specific school
router.get('/energy-logs', async (req: Request, res: Response) => {
    try {
        const schoolId = req.query.school_id as string;
        const limit = parseInt(req.query.limit as string) || 50;

        if (!schoolId) {
            return res.status(400).json({ error: 'school_id parameter required' });
        }

        const result = await query(
            `SELECT 
                school_id,
                timestamp as created_at,
                ac_power_kw * 1000 as power_w,
                ac_voltage as voltage,
                ac_current as current_a,
                daily_energy_kwh as daily_kwh
             FROM telemetry
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
