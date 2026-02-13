import { query } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { DateTime } from 'luxon';

const AGGREGATION_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
let schedulerInterval: NodeJS.Timeout | null = null;
let isJobRunning = false;

/**
 * Daily Aggregation Job
 * Scans for days that have telemetry but no entry in telemetry_daily.
 * This handles successful "yesterdays" and even "todays" that are complete (in terms of being past midnight local time).
 */
async function runAggregationJob() {
    if (isJobRunning) {
        logger.warn('⚠️ Aggregation job skipped (previous job still running)');
        return;
    }
    isJobRunning = true;

    try {
        const now = new Date();
        logger.info('⏳ Starting daily aggregation job...');

        // 1. Find candidate missing days
        // We want to find (school_id, local_date) where local_date < CURRENT_DATE(school_tz)
        // AND NOT EXISTS in telemetry_daily

        const result = await query(`
            SELECT DISTINCT t.school_id, t.local_date
            FROM public.telemetry t
            JOIN public.schools s ON t.school_id = s.id
            LEFT JOIN public.telemetry_daily d ON t.school_id = d.school_id AND t.local_date = d.day
            WHERE 
                t.local_date IS NOT NULL 
                AND t.local_date < (NOW() AT TIME ZONE 'Asia/Jakarta')::DATE -- Strictly past days (Jakarta)
                AND d.day IS NULL -- Only missing ones
            LIMIT 1000 -- Batch size
        `);

        if (result.rows.length === 0) {
            logger.info('✅ No pending aggregations found');
            return;
        }

        logger.info({ count: result.rows.length }, '📊 Found pending daily aggregations');

        for (const row of result.rows) {
            try {
                // Call the procedure
                await query(`CALL public.aggregate_daily_stats($1, $2)`, [row.school_id, row.local_date]);
            } catch (err) {
                logger.error({
                    err,
                    schoolId: row.school_id,
                    date: row.local_date
                }, '❌ Failed to aggregate school day');
            }
        }

        logger.info('✅ Daily aggregation job complete');

    } catch (error) {
        logger.error({ err: error }, '❌ Aggregation job crashed');
    } finally {
        isJobRunning = false;
    }
}

export function startScheduler() {
    if (schedulerInterval) return;

    logger.info('🕒 Scheduler started (interval: 15m)');

    // Run once on startup after a small delay
    setTimeout(runAggregationJob, 10000);

    schedulerInterval = setInterval(runAggregationJob, AGGREGATION_INTERVAL_MS);
}

export function stopScheduler() {
    if (schedulerInterval) {
        clearInterval(schedulerInterval);
        schedulerInterval = null;
        logger.info('🛑 Scheduler stopped');
    }
}
