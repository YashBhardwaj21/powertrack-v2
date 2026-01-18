import express from 'express';
import { query } from '../db/index.js';

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const result = await query('SELECT id, name, vendor, protocol, version FROM public.device_profiles ORDER BY name');
        res.json(result.rows);
    } catch (error) {
        console.error('Get device profiles error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
