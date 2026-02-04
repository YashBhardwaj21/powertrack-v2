
import { query } from '../db/index.js';

const runDebug = async () => {
    try {
        console.log("--- Debugging Hourly Energy ---");

        // 1. Check raw telemetry for the last 50 points
        console.log("1. Raw Telemetry (Last 10):");
        const rawRes = await query(`
            SELECT timestamp, school_id, ac_power_kw, total_energy_kwh 
            FROM public.telemetry 
            ORDER BY timestamp DESC 
            LIMIT 10
        `);
        console.table(rawRes.rows);

        // 2. Run the exact hourly aggregation query
        const schoolId = rawRes.rows[0]?.school_id; // Pick a school from data
        const interval = '1 hour';
        const schoolTimezone = 'UTC';

        console.log(`2. Running Hourly Query for School: ${schoolId}`);

        const hourlyHistoryResult = await query(
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
                    AVG(t.ac_power_kw) as avg_power,
                    MAX(t.total_energy_kwh) as lifetime_max
                FROM public.telemetry t
                WHERE t.timestamp >= NOW() - INTERVAL '26 hours' 
                AND t.school_id = $3
                GROUP BY 1
            ),
            hourly_deltas AS (
                SELECT 
                    time_bucket,
                    avg_power,
                    lifetime_max,
                    lifetime_max - LAG(lifetime_max) OVER (ORDER BY time_bucket) as energy_delta
                FROM per_school_hourly
            )
            SELECT 
                tb.time_bucket as hour,
                COALESCE(hd.avg_power, 0) as avg_power,
                hd.lifetime_max,
                hd.energy_delta,
                GREATEST(COALESCE(hd.energy_delta, 0), 0) as energy
            FROM time_buckets tb
            LEFT JOIN hourly_deltas hd ON tb.time_bucket = hd.time_bucket
            WHERE tb.time_bucket >= date_trunc('hour', NOW() AT TIME ZONE $2 - INTERVAL '24 hours')
            ORDER BY tb.time_bucket ASC`,
            [interval, schoolTimezone, schoolId]
        );

        console.table(hourlyHistoryResult.rows.map(r => ({
            hour: new Date(r.hour).toISOString(),
            max: r.lifetime_max,
            delta: r.energy_delta,
            final_energy: r.energy
        })));

    } catch (error) {
        console.error("Debug Error:", error);
    }
};

runDebug();
