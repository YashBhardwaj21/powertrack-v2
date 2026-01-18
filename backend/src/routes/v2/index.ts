import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        version: 'v2.0.0-alpha',
        message: 'PowerTrack API V2 (Future Preview)',
        deprecation_policy: 'https://powertrack.dev/api/deprecation'
    });
});

export default router;
