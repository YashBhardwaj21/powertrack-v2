
import { pool } from '../db/index.js';

const getProfile = async () => {
    try {
        const res = await pool.query('SELECT * FROM public.device_profiles');
        console.log('Available Profiles:', JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
};

getProfile();
