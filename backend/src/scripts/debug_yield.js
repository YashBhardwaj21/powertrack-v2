import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/powertrack',
    ssl: false
});

async function inspectMath() {
    try {
        const res = await pool.query(`
            SELECT 
                s.name, 
                s.total_capacity_kwp, 
                MAX(t.daily_energy_kwh) as today_kwh
            FROM public.schools s
            LEFT JOIN public.telemetry t ON s.id = t.school_id
            GROUP BY s.id
            ORDER BY s.name
        `);

        console.log('--- Yield Diagnostics ---');
        console.log('School | Capacity (kWp) | Today Energy (kWh) | Specific Yield (kWh/kWp)');
        res.rows.forEach(r => {
            const cap = parseFloat(r.total_capacity_kwp || 0);
            const energy = parseFloat(r.today_kwh || 0);
            const yieldVal = cap > 0 ? (energy / cap).toFixed(4) : '0.0000';
            console.log(`${r.name.padEnd(20)} | ${cap.toFixed(1).padEnd(14)} | ${energy.toFixed(3).padEnd(18)} | ${yieldVal}`);
        });
    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

inspectMath();
