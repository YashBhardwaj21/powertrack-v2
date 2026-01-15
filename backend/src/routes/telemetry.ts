import express, { Request, Response } from 'express';
import { query } from '../db/index.js';
import { validate, telemetryValidation } from '../middleware/validation.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { broadcastTelemetryUpdate } from '../websocket/index.js';

const router = express.Router();

/* =========================================================
   TELEMETRY INGESTION (ESP32 / DEVICES)
========================================================= */
router.post(
    '/ingest',
    authenticateApiKey,
    validate(telemetryValidation),
    async (req: Request, res: Response) => {
        try {
            const schoolId = (req as any).schoolId;

            if (!schoolId) {
                return res.status(401).json({ error: 'Unauthorized device' });
            }

            const {
                power_w,
                voltage,
                current_a,
                daily_kwh,
                total_kwh,
                temp_c,
                irradiance_wm2,
                weather_condition,
            } = req.body;

            // Derived values
            const ac_power_kw = power_w !== undefined ? power_w / 1000 : null;

            const efficiency_percent =
                irradiance_wm2 && irradiance_wm2 > 0 && power_w
                    ? (power_w / (irradiance_wm2 * 1000)) * 100
                    : null;

            const result = await query(
                `INSERT INTO public.telemetry (
                    school_id,
                    ac_power_kw,
                    ac_voltage,
                    ac_current,
                    daily_energy_kwh,
                    total_energy_kwh,
                    panel_temp_c,
                    irradiance_wm2,
                    efficiency_percent,
                    weather_condition
                ) VALUES (
                    $1,$2,$3,$4,$5,$6,$7,$8,$9,$10
                )
                RETURNING *`,
                [
                    schoolId,
                    ac_power_kw,
                    voltage ?? null,
                    current_a ?? null,
                    daily_kwh ?? null,
                    total_kwh ?? null,
                    temp_c ?? null,
                    irradiance_wm2 ?? null,
                    efficiency_percent,
                    weather_condition ?? null,
                ]
            );

            const telemetryData = result.rows[0];

            // Push live update to dashboards
            broadcastTelemetryUpdate(telemetryData);

            res.status(201).json({
                success: true,
                school_id: schoolId,
                data: telemetryData,
            });
        } catch (error) {
            console.error('Telemetry ingestion error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

/* =========================================================
   LATEST TELEMETRY (PER SCHOOL)
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

/* =========================================================
   TELEMETRY HISTORY
========================================================= */
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

/* =========================================================
   ALL LATEST TELEMETRY (DASHBOARD)
========================================================= */
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
