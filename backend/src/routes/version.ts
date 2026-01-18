import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        service: 'powertrack-api',
        version: 'v1.0.0',
        environment: process.env.NODE_ENV,
        maintenance_mode: false,
        deprecation_warning: null,
        next_version: '/api/v2'
    });
});

export default router;
