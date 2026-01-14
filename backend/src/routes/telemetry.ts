import express, { Request, Response } from 'express';
import { query } from '../db/index.js';
import { validate, telemetryValidation } from '../middleware/validation.js';
import { authenticateApiKey } from '../middleware/auth.js';
import { broadcastTelemetryUpdate } from '../websocket/index.js';

const router = express.Router();

// Telemetry ingestion endpoint (for hardware devices)
router.post('/ingest', authenticateApiKey, validate(telemetryValidation), async (req: Request, res: Response) => {
    try {
        const apiKey = req.headers['x-api-key'] as string;
        const { power_w, voltage, current_a, daily_kwh, temp_c, irradiance_wm2, weather_condition } = req.body;

        // Validate API key and get school ID
        const schoolResult = await query(
            'SELECT id FROM schools WHERE api_key = $1',
            [apiKey]
        );

        if (schoolResult.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        const schoolId = schoolResult.rows[0].id;

        // Calculate derived values
        const ac_power_kw = power_w / 1000;
        const efficiency_percent = irradiance_wm2 && irradiance_wm2 > 0
            ? (power_w / (irradiance_wm2 * 1000)) * 100
            : null;

        // Insert telemetry data
        const result = await query(
            `INSERT INTO telemetry (
                school_id, ac_power_kw, ac_voltage, ac_current, 
                daily_energy_kwh, panel_temp_c, irradiance_wm2, 
                efficiency_percent, weather_condition
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *`,
            [
                schoolId,
                ac_power_kw,
                voltage,
                current_a,
                daily_kwh,
                temp_c,
                irradiance_wm2,
                efficiency_percent,
                weather_condition,
            ]
        );

        const telemetryData = result.rows[0];

        // Broadcast update to WebSocket clients
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
});

// Get latest telemetry for a school
router.get('/:schoolId/latest', async (req: Request, res: Response) => {
    try {
        const { schoolId } = req.params;

        const result = await query(
            `SELECT * FROM telemetry 
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

// Get telemetry history for a school
router.get('/:schoolId/history', async (req: Request, res: Response) => {
    try {
        const { schoolId } = req.params;
        const limit = parseInt(req.query.limit as string) || 50;
        const offset = parseInt(req.query.offset as string) || 0;

        const result = await query(
            `SELECT * FROM telemetry 
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

// Get all latest telemetry (for dashboard)
router.get('/all/latest', async (req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT DISTINCT ON (school_id) * 
             FROM telemetry 
             ORDER BY school_id, timestamp DESC`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get all telemetry error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
