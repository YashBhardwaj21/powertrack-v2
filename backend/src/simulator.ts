import { query } from './db/index.js';
import { logger } from './utils/logger.js';
import { broadcastTelemetryUpdate } from './websocket/index.js';
import { DateTime } from 'luxon';
import {
    getLocalHour, getDayOfYear,
    daylightFactor, calcIrradiance, calcTemperature,
    getSunriseSunset,
    getBaseLoad, loadFactor,
    getRandomWeather, WEATHER_FACTOR
} from './utils/solarModels.js';

// ═══════════ TYPES ═══════════
interface School {
    id: string;
    name: string;
    timezone: string;
    latitude: number;
    longitude: number;
    total_capacity_kwp: number;
}

// ═══════════ STATE ═══════════
let intervalId: NodeJS.Timeout | null = null;
let schoolsCache: School[] = [];
let lastFetch = 0;
const CACHE_TTL = process.env.NODE_ENV === 'development' ? 60_000 : 120_000;

// Internal State for Incremental Simulation
interface SimState {
    lastTick: number; // timestamp
    dailyEnergy: number;
    totalEnergy: number;
    dailyExport: number;
    dailyImport: number;
    dailySelfConsumed: number; // Track self-consumption too
    currentLocalDay: number; // To detect midnight crossings
}

const simState: Record<string, SimState> = {};
const schoolWeather: Record<string, string> = {};

const PF = 0.95;
const SYSTEM_EFFICIENCY = 0.85;

// ═══════════ SCHOOL CACHE ═══════════
async function getSchools(): Promise<School[]> {
    if (Date.now() - lastFetch > CACHE_TTL || !schoolsCache.length) {
        const res = await query(`
            SELECT id, name, timezone, latitude, longitude, total_capacity_kwp
            FROM schools WHERE deleted_at IS NULL
        `);
        schoolsCache = res.rows;
        lastFetch = Date.now();
        logger.info({ count: schoolsCache.length }, '📦 Schools cache refreshed');
    }
    return schoolsCache;
}

// Manual cache invalidation for immediate refresh
export function invalidateSchoolCache() {
    lastFetch = 0;
    schoolsCache = [];
    logger.info('🔄 School cache invalidated');
}

// ═══════════ RETRY HELPER ═══════════
async function retryQuery(sql: string, params: any[], maxRetries = 3): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await query(sql, params);
        } catch (err) {
            if (attempt === maxRetries) throw err;
            const delayMs = Math.min(1000 * Math.pow(2, attempt), 5000);
            logger.warn({ attempt, delayMs, err }, '⚠️ Query failed, retrying...');
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
}

// ═══════════ STARTUP (Hydrate State) ═══════════
async function seedFromDB() {
    // Optional manual wipe via environment variable (for testing/dev only)
    if (process.env.WIPE_ON_START === 'true') {
        logger.warn('🔥 MANUAL WIPE: Deleting all telemetry data per WIPE_ON_START env var...');
        await query('DELETE FROM telemetry');
        await query('DELETE FROM telemetry_daily');
        logger.info('✅ Telemetry wiped. Starting fresh.');
    }

    const schools = await getSchools();
    logger.info('🌱 Hydrating Simulator State from DB...');

    for (const s of schools) {
        const id = s.id;
        const tz = s.timezone || 'Asia/Jakarta';
        try {
            // Get the LAST known telemetry point to resume counting
            const res = await query(`
                SELECT total_energy_kwh, daily_energy_kwh, 
                       daily_export_kwh, daily_import_kwh, 
                       daily_self_consumed_kwh, timestamp
                FROM telemetry 
                WHERE school_id = $1 
                ORDER BY timestamp DESC 
                LIMIT 1
            `, [id]);

            const row = res.rows[0];
            const nowDt = DateTime.now().setZone(tz);

            simState[id] = {
                lastTick: Date.now(), // fresh start clock
                dailyEnergy: Number(row?.daily_energy_kwh) || 0,
                totalEnergy: Number(row?.total_energy_kwh) || 0,
                dailyExport: Number(row?.daily_export_kwh) || 0,
                dailyImport: Number(row?.daily_import_kwh) || 0,
                dailySelfConsumed: Number(row?.daily_self_consumed_kwh) || 0,
                currentLocalDay: nowDt.ordinal
            };

            // If we restarted on a new day compared to DB, reset daily counts immediately
            if (row?.timestamp) {
                const lastDbDate = DateTime.fromJSDate(new Date(row.timestamp)).setZone(tz);
                if (lastDbDate.ordinal !== nowDt.ordinal || lastDbDate.year !== nowDt.year) {
                    logger.info({ school: s.name }, '🔄 New day detected during hydration, resetting daily counters');
                    simState[id].dailyEnergy = 0;
                    simState[id].dailyExport = 0;
                    simState[id].dailyImport = 0;
                    simState[id].dailySelfConsumed = 0;
                }
            }

            // Initial weather
            schoolWeather[id] = getRandomWeather();

        } catch (err) {
            logger.warn({ school: s.name, err }, '⚠️ Failed to hydrate state, starting from 0');
            simState[id] = {
                lastTick: Date.now(),
                dailyEnergy: 0,
                totalEnergy: 0,
                dailyExport: 0,
                dailyImport: 0,
                dailySelfConsumed: 0,
                currentLocalDay: DateTime.now().setZone(tz).ordinal
            };
        }
    }
    logger.info('✅ State hydrated. Simulator is ready.');
}

// ═══════════ MAIN TICK ═══════════
async function simulateTick() {
    const schools = await getSchools();
    const now = Date.now();

    for (const school of schools) {
        try {
            const id = school.id;
            const tz = school.timezone || 'Asia/Jakarta';
            const lat = Number(school.latitude) || -6.2;
            const capacity = Number(school.total_capacity_kwp) || 5;

            // Initialize state if missing (e.g. new school added mid-run)
            if (!simState[id]) {
                simState[id] = {
                    lastTick: now,
                    dailyEnergy: 0, totalEnergy: 0, dailyExport: 0, dailyImport: 0, dailySelfConsumed: 0,
                    currentLocalDay: DateTime.now().setZone(tz).ordinal
                };
            }

            const state = simState[id];

            // 1. Single Timestamp Source (Critical Fix)
            const tickTimestamp = new Date();
            const localTime = DateTime.fromJSDate(tickTimestamp).setZone(tz);

            // 2. Time & Weather
            if (!schoolWeather[id] || Math.random() < 0.01) {
                schoolWeather[id] = getRandomWeather();
            }
            const weather = schoolWeather[id];
            const weatherMult = WEATHER_FACTOR[weather];

            const localHour = localTime.hour + localTime.minute / 60;
            const dayOfYear = localTime.ordinal;

            // 2. Strict Nighttime Zero Check
            const { sunrise, sunset } = getSunriseSunset(lat, dayOfYear);
            let solar_kw = 0;
            let daylight = 0;
            let irradiance = 0;
            let temp = 25;

            // Only generate power if sun is UP
            if (localHour >= sunrise && localHour <= sunset) {
                daylight = daylightFactor(localHour, lat, dayOfYear);
                irradiance = calcIrradiance(daylight, weatherMult);
                temp = calcTemperature(daylight);

                if (irradiance >= 10) { // Minimal threshold
                    const performance = 0.9 + Math.random() * 0.1;
                    solar_kw = +(capacity * daylight * weatherMult * performance * SYSTEM_EFFICIENCY).toFixed(3);
                }
            } else {
                // Night time: 0 solar, strictly.
                solar_kw = 0;
                irradiance = 0;
                temp = 20; // cooler at night
            }

            // 3. Load Model
            const baseLoad = getBaseLoad(capacity);
            const load_kw = +(Math.max(baseLoad * 0.35, baseLoad * loadFactor(localHour)) * (0.95 + Math.random() * 0.1)).toFixed(3);

            // 4. Instantaneous Flow
            const exportKw = +Math.max(0, solar_kw - load_kw).toFixed(3);
            const importKw = +Math.max(0, load_kw - solar_kw).toFixed(3);

            // Self-consumed is strictly what's generated MINUS what's exported
            // OR simply min(generated, load)
            const selfConsumedKw = Math.min(solar_kw, load_kw);

            const current = solar_kw > 0 ? (solar_kw * 1000 / (230 * PF)).toFixed(2) : '0.00';

            // 5. Incremental Accumulation (The Core Logic)
            // Clamp delta to max 30 seconds to prevent massive spikes if server sleeps
            const rawDeltaHours = (tickTimestamp.getTime() - state.lastTick) / 3600000;
            let deltaHours = Math.min(rawDeltaHours, 30 / 3600);

            // 6. Corrected Midnight Crossing Logic
            const currentDay = localTime.ordinal;

            if (currentDay !== state.currentLocalDay) {
                // Calculate the ACTUAL midnight boundary we crossed
                const midnightMs = DateTime
                    .fromJSDate(new Date(state.lastTick))
                    .setZone(tz)
                    .plus({ days: 1 })
                    .startOf('day')
                    .toMillis();

                const nowMs = tickTimestamp.getTime();
                const lastTickMs = state.lastTick;

                // Split: old day portion vs new day portion
                const oldDayMs = midnightMs - lastTickMs;
                const newDayMs = nowMs - midnightMs;

                const oldDayHours = oldDayMs / 3600000;
                const newDayHours = newDayMs / 3600000;

                // Apply old day energy to totals BEFORE reset
                const oldDayEnergy = solar_kw * oldDayHours;
                state.totalEnergy += oldDayEnergy;
                state.dailyEnergy += oldDayEnergy;

                logger.info({
                    school: school.name,
                    oldDayHours: oldDayHours.toFixed(4),
                    newDayHours: newDayHours.toFixed(4),
                    oldDayEnergy: oldDayEnergy.toFixed(4)
                }, '🌙 Midnight split');

                // NOW reset for new day
                state.dailyEnergy = 0;
                state.dailyExport = 0;
                state.dailyImport = 0;
                state.dailySelfConsumed = 0;
                state.currentLocalDay = currentDay;

                // Recalculate delta for NEW day portion only
                deltaHours = newDayHours;
            }

            // 7. TWO-PHASE COMMIT PATTERN
            // Phase 1: Calculate increments (don't mutate state yet)
            const genKwh = solar_kw * deltaHours;
            const exportKwh = exportKw * deltaHours;
            const importKwh = importKw * deltaHours;
            const selfKwh = selfConsumedKw * deltaHours;

            // Phase 2: Persist to DB with FUTURE state
            let inserted = false;
            try {
                await retryQuery(`
                    INSERT INTO telemetry (
                        school_id, timestamp, ac_power_kw, ac_voltage, ac_current,
                        daily_energy_kwh, total_energy_kwh,
                        daily_export_kwh, daily_import_kwh, daily_self_consumed_kwh,
                        load_kw, grid_export_kw, grid_import_kw,
                        irradiance_wm2, panel_temp_c, weather_condition
                    ) VALUES ($1,$2,$3,230,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
                `, [
                    id,
                    tickTimestamp,
                    solar_kw,
                    current,
                    (state.dailyEnergy + genKwh).toFixed(4),
                    (state.totalEnergy + genKwh).toFixed(4),
                    (state.dailyExport + exportKwh).toFixed(4),
                    (state.dailyImport + importKwh).toFixed(4),
                    (state.dailySelfConsumed + selfKwh).toFixed(4),
                    load_kw,
                    exportKw,
                    importKw,
                    irradiance.toFixed(1),
                    temp.toFixed(1),
                    weather
                ]);
                inserted = true;
            } catch (err) {
                logger.error({ school: school.name, err }, '❌ Persist failed after retries');
            }

            // Phase 3: Commit state ONLY if DB write succeeded
            if (inserted) {
                state.dailyEnergy += genKwh;
                state.totalEnergy += genKwh;
                state.dailyExport += exportKwh;
                state.dailyImport += importKwh;
                state.dailySelfConsumed += selfKwh;
                state.lastTick = tickTimestamp.getTime();

                logger.info({
                    school: school.name,
                    time: localHour.toFixed(2),
                    solar: solar_kw,
                    daily: state.dailyEnergy.toFixed(3),
                    total: state.totalEnergy.toFixed(3),
                    tickTimestamp: tickTimestamp.toISOString()
                }, '☀️ Tick');

                broadcastTelemetryUpdate({
                    school_id: id,
                    timestamp: tickTimestamp,
                    ac_power_kw: solar_kw,
                    ac_voltage: 230,
                    ac_current: Number(current),
                    total_energy_kwh: state.totalEnergy,
                    daily_energy_kwh: state.dailyEnergy,
                    daily_export_kwh: state.dailyExport,
                    daily_import_kwh: state.dailyImport,
                    load_kw: load_kw,
                    grid_export_kw: exportKw,
                    grid_import_kw: importKw,
                    irradiance_wm2: irradiance,
                    panel_temp_c: temp,
                    weather_condition: weather,
                    performance_ratio: 0.9,
                    efficiency_percent: 19.5,
                    fault: 'none',
                    quality_score: 100
                });
            } else {
                // Don't update state - will retry on next tick with same baseline
                logger.warn({ school: school.name }, '⚠️ Skipping state update due to DB failure');
                continue;
            }

        } catch (err) {
            logger.error({ err, school: school.name }, '❌ Tick failed');
        }
    }
}

// ═══════════ START/STOP ═══════════
let advisoryLockHeld = false;

export async function startSimulator() {
    if (intervalId) return;

    // Acquire advisory lock to prevent duplicate instances
    try {
        const lockResult = await query('SELECT pg_try_advisory_lock(987654321)');
        advisoryLockHeld = lockResult.rows[0].pg_try_advisory_lock;

        if (!advisoryLockHeld) {
            logger.error('❌ Another simulator instance is already running. Aborting.');
            throw new Error('Simulator lock conflict - another instance running');
        }

        logger.info('🔒 Acquired simulator advisory lock');
    } catch (err) {
        logger.error({ err }, '❌ Failed to acquire simulator lock');
        throw err;
    }

    logger.info('🚀 Starting INCREMENTAL Simulator...');
    await seedFromDB();
    simulateTick();
    intervalId = setInterval(simulateTick, 10_000);
}

export function stopSimulator() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;

        // Release advisory lock
        if (advisoryLockHeld) {
            query('SELECT pg_advisory_unlock(987654321)')
                .then(() => logger.info('🔓 Released simulator advisory lock'))
                .catch(err => logger.error({ err }, 'Failed to release lock'));
            advisoryLockHeld = false;
        }

        logger.info('🛑 Simulator stopped');
    }
}
