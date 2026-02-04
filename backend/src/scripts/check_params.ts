import { query, pool } from '../db/index.js';

async function checkParams() {
    try {
        const res = await query('SELECT * FROM public.system_parameters');
        console.table(res.rows);
        await pool.end();
    } catch (err) {
        console.error(err);
    }
}
checkParams();
