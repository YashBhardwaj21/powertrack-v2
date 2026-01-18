import express, { Request, Response } from 'express';
import { query } from '../db/index.js';
import { validate } from '../middleware/validation.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { broadcastTelemetryUpdate } from '../websocket/index.js';
import { telemetryIngestSchema } from '../validation/schemas.js';

const router = express.Router();

/* =========================================================
   TELEMETRY INGESTION (API KEY PROTECTED)
========================================================= */
router.post(
    '/',
    authenticateApiKey,
    validate(telemetryIngestSchema),
    async (req: Request, res: Response) => {
        try {
            // 1. Identification
            const schoolId = (req as any).schoolId;
            const profile = (req as any).deviceProfile;
            const payload = req.body;

            // 2. Clock Drift Handling (Strict & Explicit)
            const nowSeconds = Math.floor(Date.now() / 1000);
            // Default to nowSeconds if payload.ts is missing, resulting in 0 drift (trusting server time)
            const deviceTs = payload.ts || nowSeconds;
            const driftSeconds = Math.abs(nowSeconds - deviceTs);

            let isSuspectTime = false;
            let ingestionFlag = 'normal';
            let isBackfill = false;

            if (driftSeconds > 86400) { // > 24h drift
                isSuspectTime = true;
                ingestionFlag = 'suspect_time';
                console.warn(`[Ingest] Suspect timestamp from ${schoolId}: drift=${driftSeconds}s`);
            } else if (driftSeconds > 600) { // > 10 min
                isBackfill = true;
                ingestionFlag = 'backfill';
            }

            // 3. Mapping Logic (Strict - No Guessing)
            const map = profile?.field_map || {};
            const getVal = (stdKey: string): number | null => {
                const deviceKey = map[stdKey];
                if (!deviceKey) return null; // Field not expected from this device
                const val = (payload as any)[deviceKey];
                return (typeof val === 'number') ? val : null;
            };

            const data = {
                power_w: getVal('power') ?? null, // Ensure undefined becomes null
                voltage: getVal('voltage') ?? null,
                current_a: getVal('current') ?? null,
                daily_kwh: getVal('energy_today') ?? null,
                energy_total_kwh: getVal('energy_total') ?? null,
                // Backend-specific derived or optional
                temp_c: payload.temp_c ?? null,
                irradiance_wm2: payload.irradiance_wm2 ?? null,
                load_kw: payload.load_kw ?? null,
                grid_import_kw: payload.grid_import_kw ?? null,
                grid_export_kw: payload.grid_export_kw ?? null,
                weather: payload.weather_condition || 'unknown'
            };

            // 4. Data Quality & Derived Values
            const ac_power_kw = data.power_w !== null ? data.power_w / 1000 : 0; // Default to 0 if null to satisfy NN

            // Calculate efficiency if irradiance is present
            const efficiency_percent =
                (data.irradiance_wm2 !== null && data.irradiance_wm2 > 0) && data.power_w !== null
                    ? (data.power_w / (data.irradiance_wm2 * 1000)) * 100
                    : null;

            const quality_score = data.power_w === null || data.voltage === null ? 0.5 : 1.0;

            // 5. DRY-RUN MODE (Diagnostics)
            if (req.query.dry_run === 'true') {
                const schoolName = (req as any).schoolName || 'Unknown';
                const profileName = profile.name || 'Unknown Profile';

                return res.json({
                    dry_run: true,
                    school: schoolName,
                    school_id: schoolId,
                    device_profile: profileName,
                    mapped_fields: data,
                    derived_values: {
                        ac_power_kw,
                        efficiency_percent,
                        quality_score
                    },
                    ingestion_flag: ingestionFlag,
                    warnings: driftSeconds > 86400 ? [{
                        code: 'TIMESTAMP_OUT_OF_RANGE',
                        message: 'Data may not appear in dashboard due to timestamp age',
                        drift_seconds: driftSeconds
                    }] : [],
                    status: 'READY',
                    message: 'Dry run successful - no data inserted'
                });
            }

            // 6. Insert with Auto-Partitioning Trigger (Handled by DB)
            const result = await query(
                `INSERT INTO public.telemetry (
                    school_id,
                    timestamp,
                    ac_power_kw,
                    ac_voltage,
                    ac_current,
                    daily_energy_kwh,
                    total_energy_kwh,
                    panel_temp_c,
                    irradiance_wm2,
                    efficiency_percent,
                    load_kw,
                    grid_export_kw,
                    grid_import_kw,
                    weather_condition,
                    fault,
                    quality_score,
                    is_backfill,
                    is_suspect_time
                ) VALUES (
                    $1, 
                    COALESCE(to_timestamp($2::numeric), NOW()),
                    $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
                )
                RETURNING *`,
                [
                    schoolId,
                    deviceTs, // Use validated timestamp
                    ac_power_kw,
                    data.voltage || 0,
                    data.current_a || 0,
                    data.daily_kwh || 0,
                    data.energy_total_kwh || 0,
                    data.temp_c,
                    data.irradiance_wm2,
                    efficiency_percent,
                    data.load_kw || 0,
                    data.grid_export_kw || 0,
                    data.grid_import_kw || 0,
                    data.weather,
                    isSuspectTime ? 'comm_down' : 'none', // Simple fault mapping
                    quality_score,
                    isBackfill,
                    isSuspectTime
                ]
            );

            const telemetryData = result.rows[0];

            // 7. Broadcast (Throttled later)
            broadcastTelemetryUpdate(telemetryData);

            // 8. Build Response with Warnings
            const response: any = {
                success: true,
                school_id: schoolId,
                ingestion_flag: ingestionFlag,
                data: telemetryData
            };

            // Add visibility warnings for old timestamps
            if (driftSeconds > 86400) {
                response.warnings = [{
                    code: 'TIMESTAMP_OUT_OF_RANGE',
                    message: 'Data received but may not appear in dashboard due to timestamp age',
                    drift_seconds: driftSeconds,
                    visibility_state: 'hidden_by_time_filter'
                }];
            }

            res.status(201).json(response);

        } catch (error: any) {
            console.error('[Ingest] Telemetry ingestion error:', error);

            // Check for specific database errors
            if (error.code === '23503') { // FK violation
                return res.status(500).json({
                    error: 'Foreign key constraint violation',
                    code: 'FK_VIOLATION',
                    resolution: 'Database integrity issue - contact administrator'
                });
            }

            return res.status(500).json({
                error: 'Telemetry ingestion failed',
                code: 'DATABASE_ERROR',
                resolution: 'Temporary system issue - please retry. Contact support if persists.',
                // DEBUG INFO
                debug_message: error.message,
                debug_detail: error.detail,
                debug_hint: error.hint
            });
        }
    }
);

/* =========================================================
   GET HELPERS
========================================================= */
router.get('/:schoolId/latest', async (req: Request, res: Response) => {
    try {
        const { schoolId } = req.params;

        const result = await query(
            `SELECT *
             FROM public.telemetry
             WHERE school_id = $1
             ORDER BY timestamp DESC
             LIMIT 1`,
            [schoolId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'No telemetry data found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get latest telemetry error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get('/:schoolId/history', async (req: Request, res: Response) => {
    try {
        const { schoolId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const result = await query(
            `SELECT *
             FROM public.telemetry
             WHERE school_id = $1
             ORDER BY timestamp DESC
             LIMIT $2 OFFSET $3`,
            [schoolId, limit, offset]
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get telemetry history error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/all/latest', async (_req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT DISTINCT ON (school_id) *
             FROM public.telemetry
             ORDER BY school_id, timestamp DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get all telemetry error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
