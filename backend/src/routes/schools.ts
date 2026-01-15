import express, { Request, Response } from 'express';
import crypto from 'crypto';
import { query } from '../db/index.js';
import { authenticateToken, requireRole } from '../middleware/auth.js';

const router = express.Router();

/* =========================================================
   GET ALL SCHOOLS (PUBLIC)
========================================================= */
router.get('/', async (_req: Request, res: Response) => {
    try {
        const result = await query(
            `SELECT id, name, type, district, latitude, longitude,
                    total_capacity_kwp, total_cost_idr, created_at
             FROM public.schools
             ORDER BY name`
        );

        res.json(result.rows);
    } catch (error) {
        console.error('Get schools error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/* =========================================================
   GET SCHOOL BY ID
========================================================= */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        const result = await query(
            `SELECT id, name, type, district, latitude, longitude,
                    total_capacity_kwp, total_cost_idr, created_at
             FROM public.schools
             WHERE id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'School not found' });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error('Get school error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/* =========================================================
   CREATE SCHOOL (ADMIN ONLY)
========================================================= */
router.post(
    '/',
    authenticateToken,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
        try {
            const {
                name,
                type,
                district,
                latitude,
                longitude,
                total_capacity_kwp,
                total_cost_idr,
            } = req.body;

            // 🔐 Generate API key in backend (SAFE)
            const apiKey = crypto.randomBytes(32).toString('hex');

            const result = await query(
                `INSERT INTO public.schools (
                    name,
                    type,
                    district,
                    latitude,
                    longitude,
                    total_capacity_kwp,
                    total_cost_idr,
                    api_key
                 )
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                 RETURNING *`,
                [
                    name,
                    type,
                    district,
                    latitude,
                    longitude,
                    total_capacity_kwp,
                    total_cost_idr,
                    apiKey,
                ]
            );

            res.status(201).json(result.rows[0]);
        } catch (error) {
            console.error('Create school error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

/* =========================================================
   UPDATE SCHOOL (ADMIN ONLY)
========================================================= */
router.put(
    '/:id',
    authenticateToken,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
        try {
            const { id } = req.params;
            const {
                name,
                type,
                district,
                latitude,
                longitude,
                total_capacity_kwp,
                total_cost_idr,
            } = req.body;

            const result = await query(
                `UPDATE public.schools
                 SET name = COALESCE($1, name),
                     type = COALESCE($2, type),
                     district = COALESCE($3, district),
                     latitude = COALESCE($4, latitude),
                     longitude = COALESCE($5, longitude),
                     total_capacity_kwp = COALESCE($6, total_capacity_kwp),
                     total_cost_idr = COALESCE($7, total_cost_idr)
                 WHERE id = $8
                 RETURNING *`,
                [
                    name,
                    type,
                    district,
                    latitude,
                    longitude,
                    total_capacity_kwp,
                    total_cost_idr,
                    id,
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'School not found' });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error('Update school error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

/* =========================================================
   GET SCHOOL API KEY (ADMIN / SCHOOL_ADMIN)
========================================================= */
router.get('/:id/api-key', authenticateToken, async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        if (req.user?.role !== 'admin' && req.user?.schoolId !== id) {
            return res.status(403).json({ error: 'Access denied' });
        }

        const result = await query(
            'SELECT api_key FROM public.schools WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'School not found' });
        }

        res.json({ api_key: result.rows[0].api_key });
    } catch (error) {
        console.error('Get API key error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/* =========================================================
   REGENERATE API KEY (ADMIN ONLY)
========================================================= */
router.post(
    '/:id/regenerate-api-key',
    authenticateToken,
    requireRole(['admin']),
    async (req: Request, res: Response) => {
        try {
            const { id } = req.params;

            const newApiKey = crypto.randomBytes(32).toString('hex');

            const result = await query(
                `UPDATE public.schools
                 SET api_key = $1
                 WHERE id = $2
                 RETURNING api_key`,
                [newApiKey, id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'School not found' });
            }

            res.json({ api_key: result.rows[0].api_key });
        } catch (error) {
            console.error('Regenerate API key error:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }
);

export default router;
