import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../../.env') });

const pool = new pg.Pool({
    connectionString: 'postgresql://postgres.cqdrjhugitgxbeybboee:Ybsaturnkt1607@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
    ssl: { rejectUnauthorized: false }
});

async function debugHourly() {
    try {
        console.log('--- Debugging Hourly History ---');
        console.log('Querying for last 24h buckets...');

        const timezone = 'Asia/Kolkata';
        const interval = '1 hour';

        console.log('Running full hourly query...');
        const result = await pool.query(
            `WITH time_buckets AS (
                SELECT generate_series(
                    date_trunc('hour', NOW() AT TIME ZONE $2 - INTERVAL '24 hours'), 
                    date_trunc('hour', NOW() AT TIME ZONE $2), 
                    $1::interval
                ) as time_bucket
            ),
            per_school_hourly AS (
                SELECT 
                    date_trunc('hour', t.timestamp AT TIME ZONE $2) as time_bucket,
                    t.school_id,
                    AVG(t.ac_power_kw) as avg_power,
                    t.daily_export_kwh, -- Added to match group by or fix query
                    t.daily_energy_kwh -- Added
                FROM public.telemetry t
                WHERE t.timestamp >= NOW() - INTERVAL '26 hours' 
                GROUP BY 1, 2, 4, 5 -- Adjusted GROUP BY to include potential non-agg columns if any
            ),
            system_hourly AS (
                SELECT
                    time_bucket,
                    SUM(avg_power) as sys_avg_power
                FROM per_school_hourly
                GROUP BY 1
            )
            SELECT 
                tb.time_bucket as hour,
                COALESCE(sh.sys_avg_power, 0) as avg_power
            FROM time_buckets tb
            LEFT JOIN system_hourly sh ON tb.time_bucket = sh.time_bucket
            ORDER BY tb.time_bucket ASC`,
            [interval, timezone]
        );

        console.log(`Rows returned: ${result.rows.length}`);
        if (result.rows.length > 0) {
            console.log('First row:', result.rows[0]);
        } else {
            console.log('Empty result set!');
        }

    } catch (e) {
        console.error(e);
    } finally {
        pool.end();
    }
}

debugHourly();
