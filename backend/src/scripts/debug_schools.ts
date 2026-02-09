
import { pool } from '../db/index.js';

async function checkSchools() {
    try {
        const res = await pool.query("SELECT id, name, timezone, latitude, longitude, total_capacity_kwp FROM schools WHERE name ILIKE '%Test%'");
        console.log(JSON.stringify(res.rows, null, 2));
    } catch (err) {
        console.error(err);
    } finally {
        await pool.end();
    }
}

checkSchools();
