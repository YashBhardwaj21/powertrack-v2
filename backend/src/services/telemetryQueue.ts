
import { query } from '../db/index.js';
import { logger } from '../utils/logger.js';
import { broadcastTelemetryUpdate } from '../websocket/index.js';

interface TelemetryItem {
    school_id: string;
    timestamp: Date;
    server_at: Date;
    ac_power_kw: number;
    ac_voltage: number;
    ac_current: number;
    total_energy_kwh: number;
    daily_energy_kwh: number;
    daily_export_kwh: number;
    daily_import_kwh: number;
    irradiance_wm2: number;
    panel_temp_c: number;
    performance_ratio: number;
    efficiency_percent: number;
    load_kw: number;
    grid_export_kw: number;
    grid_import_kw: number;
    weather_condition: string;
    fault: string | null;
    quality_score: number;
    is_backfill: boolean;
    is_suspect_time: boolean;
}

const BATCH_SIZE = 100;
const FLUSH_INTERVAL_MS = 1000;

class TelemetryQueue {
    private queue: TelemetryItem[] = [];
    private timer: NodeJS.Timeout | null = null;
    private isFlushing = false;

    constructor() {
        // Auto-flush timer
        this.timer = setInterval(() => this.flush(), FLUSH_INTERVAL_MS);
    }

    public push(item: TelemetryItem) {
        this.queue.push(item);

        // Broadcast immediately for real-time UI (separate from DB persistence)
        broadcastTelemetryUpdate(item);

        if (this.queue.length >= BATCH_SIZE) {
            this.flush();
        }
    }

    public async flush() {
        if (this.isFlushing || this.queue.length === 0) return;

        this.isFlushing = true;
        const batch = [...this.queue];
        this.queue = []; // Clear queue immediately to accept new items

        try {
            await this.persistBatch(batch);
            logger.debug({ count: batch.length }, '🔥 Flushed telemetry batch to DB');
        } catch (error) {
            logger.error({ err: error, count: batch.length }, '❌ Failed to flush telemetry batch');
            // Re-queue items (with basic circuit breaker to avoid infinite loops)
            // For now, we drop to avoid memory leaks, but log CRITICAL error.
            // In a real message queue (Redis), this would handle DLQ.
        } finally {
            this.isFlushing = false;
        }
    }

    private async persistBatch(batch: TelemetryItem[]) {
        if (batch.length === 0) return;

        // Construct Bulk Insert Query
        // We use UNNEST to send arrays appropriately
        const sql = `
            INSERT INTO public.telemetry (
                school_id, timestamp, server_at,
                ac_power_kw, ac_voltage, ac_current,
                total_energy_kwh, daily_energy_kwh,
                daily_export_kwh, daily_import_kwh,
                irradiance_wm2, panel_temp_c,
                performance_ratio, efficiency_percent,
                load_kw, grid_export_kw, grid_import_kw,
                weather_condition, fault, quality_score,
                is_backfill, is_suspect_time
            )
            SELECT * FROM UNNEST (
                $1::uuid[], $2::timestamptz[], $3::timestamptz[],
                $4::decimal[], $5::decimal[], $6::decimal[],
                $7::decimal[], $8::decimal[],
                $9::decimal[], $10::decimal[],
                $11::decimal[], $12::decimal[],
                $13::decimal[], $14::decimal[],
                $15::decimal[], $16::decimal[], $17::decimal[],
                $18::varchar[], $19::varchar[], $20::decimal[],
                $21::boolean[], $22::boolean[]
            )
        `;

        // Transpose object array to column vectors
        const params = [
            batch.map(i => i.school_id),
            batch.map(i => i.timestamp),
            batch.map(i => i.server_at),
            batch.map(i => i.ac_power_kw),
            batch.map(i => i.ac_voltage),
            batch.map(i => i.ac_current),
            batch.map(i => i.total_energy_kwh),
            batch.map(i => i.daily_energy_kwh),
            batch.map(i => i.daily_export_kwh),
            batch.map(i => i.daily_import_kwh),
            batch.map(i => i.irradiance_wm2),
            batch.map(i => i.panel_temp_c),
            batch.map(i => i.performance_ratio),
            batch.map(i => i.efficiency_percent),
            batch.map(i => i.load_kw),
            batch.map(i => i.grid_export_kw),
            batch.map(i => i.grid_import_kw),
            batch.map(i => i.weather_condition),
            batch.map(i => i.fault || 'none'),
            batch.map(i => i.quality_score),
            batch.map(i => i.is_backfill),
            batch.map(i => i.is_suspect_time)
        ];

        await query(sql, params);
    }
}

export const telemetryQueue = new TelemetryQueue();
