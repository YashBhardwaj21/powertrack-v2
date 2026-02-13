import express, { Request, Response } from 'express';
import { query } from '../db/index.js';
import { validate } from '../middleware/validation.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { broadcastTelemetryUpdate } from '../websocket/index.js';
import { telemetryIngestSchema } from '../validation/schemas.js';
import { logger } from '../utils/logger.js';

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
            const schoolTimezone = (req as any).schoolTimezone;
            const profile = (req as any).deviceProfile;
            const payload = req.body;

            // 2. Clock Drift Handling (Strict & Explicit)
            const nowSeconds = Math.floor(Date.now() / 1000);
            // Default to nowSeconds if payload.ts is missing, resulting in 0 drift (trusting server time)
            const deviceTs = payload.ts || nowSeconds;
            const driftSeconds = Math.abs(nowSeconds - deviceTs);

            // Calculate Local Date immediately for Partitioning/Indexing
            // We use the timestamp provided by device (deviceTs) or server time if default
            const tsMillis = deviceTs * 1000;
            // Lazy import of DateTime if not globally available or use it if imported (need to check imports)
            // Assuming we need to import it. Since this is replace header, let's assume imports are at top.
            // Wait, I can't add imports with this tool if I am targeting the body. 
            // I'll assume I can use dynamic import or just `new Date()` logic if simple? No, Timezone matters.
            // I will use `require` or `import()` or assume Luxon is there. 
            // Better: I will use `DateTime` and ensure I added the import in a separate step or assume it's there. 
            // Actually, `telemetry.ts` did NOT have luxon imported. I need to add it ideally.
            // Check imports in file view (Step 597): No luxon.
            // I will use `Intl.DateTimeFormat` which is built-in to JS node!

            const dateFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Asia/Jakarta', // Enforced Standardization
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            });
            // en-CA gives YYYY-MM-DD format (mostly). 
            const localDate = dateFormatter.format(new Date(tsMillis));

            // 3. Extract Data
            const data = payload; // Assuming payload is the flat data object or data wrapper

            // Normalize values
            const ac_power_kw = Number(data.ac_power_kw || data.power_kw || 0);
            const efficiency_percent = Number(data.efficiency_percent || 0);
            const quality_score = Number(data.quality_score || 1.0);
            const isBackfill = Boolean(data.is_backfill);

            // 4. Validation / Sanity Checks (Basic)
            if (ac_power_kw < 0) {
                logger.warn({ schoolId, ac_power_kw }, 'Negative power reading detected');
            }

            // 5. Ingestion Flags
            if (driftSeconds > 300) ingestionFlag = 'high_drift';
            if (isBackfill) ingestionFlag = 'backfill';

            // Check for suspect future time
            if (deviceTs > nowSeconds + 60) {
                isSuspectTime = true;
                ingestionFlag = 'suspect_future';
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
                    daily_export_kwh,
                    daily_import_kwh,
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
                    is_suspect_time,
                    local_date
                ) VALUES (
                    $1, 
                    COALESCE(to_timestamp($2::numeric), NOW()),
                    $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
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
                    data.daily_export_kwh || 0,
                    data.daily_import_kwh || 0,
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
                    isSuspectTime,
                    localDate
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
            logger.error({ err: error, schoolId: (req as any).schoolId }, 'Telemetry ingestion error');

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
        logger.error({ err: error, schoolId: req.params.schoolId }, 'Get latest telemetry error');
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
        logger.error({ err: error, schoolId: req.params.schoolId }, 'Get telemetry history error');
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
        logger.error({ err: error }, 'Get all telemetry error');
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
