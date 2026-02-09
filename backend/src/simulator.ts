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

// School cache
let schoolsCache: School[] = [];
let lastFetch = 0;
const CACHE_TTL = process.env.NODE_ENV === 'development' ? 60_000 : 600_000;

// Per-school state (in-memory, resets on restart)
const baseLoadBySchool: Record<string, number> = {};
const dailyEnergy: Record<string, number> = {};
const dailySelfConsumed: Record<string, number> = {}; // New: Track self interaction explicitly
const dailyExport: Record<string, number> = {};
const dailyImport: Record<string, number> = {};
const lifetimeEnergy: Record<string, number> = {};
const schoolWeather: Record<string, string> = {};
const lastDate: Record<string, string> = {};

const PF = 0.95; // Power factor
const SYSTEM_EFFICIENCY = 0.85; // Performance Ratio (PR) to account for heat, dirt, inverter losses


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

// ═══════════ STARTUP SEEDING ═══════════
// Helper for backoff
const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

// ═══════════ STARTUP SEEDING ═══════════
async function seedFromDB() {
    // 1. Ensure Checkpoint Table Exists (Auto-migration)
    await query(`
        CREATE TABLE IF NOT EXISTS simulator_checkpoint (
            school_id UUID PRIMARY KEY REFERENCES schools(id),
            last_sim_date DATE NOT NULL,
            last_verified_total_kwh NUMERIC(10, 4) DEFAULT 0,
            daily_energy_kwh NUMERIC(10, 4) DEFAULT 0,
            daily_export_kwh NUMERIC(10, 4) DEFAULT 0,
            daily_import_kwh NUMERIC(10, 4) DEFAULT 0,
            base_load_kw NUMERIC(10, 4) DEFAULT 0,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    `);

    const schools = await getSchools();

    for (const s of schools) {
        const id = s.id;
        let success = false;

        // 🔄 RETRY LOOP (Max 6 attempts: ~2s, 4s, 8s, 16s, 32s, 64s)
        for (let i = 0; i < 6; i++) {
            try {
                // 2. Try Checkpoint First (Primary Source of Truth)
                const cp = await query(
                    `SELECT * FROM simulator_checkpoint WHERE school_id=$1`,
                    [id]
                );

                if (cp.rows.length > 0) {
                    const row = cp.rows[0];
                    lifetimeEnergy[id] = Number(row.last_verified_total_kwh);
                    dailyEnergy[id] = Number(row.daily_energy_kwh);
                    dailyExport[id] = Number(row.daily_export_kwh);
                    dailyImport[id] = Number(row.daily_import_kwh);
                    baseLoadBySchool[id] = Number(row.base_load_kw);

                    // Recover self-consumed
                    dailySelfConsumed[id] = Math.max(0, dailyEnergy[id] - dailyExport[id]);

                    // Convert DB Date to ISO string YYYY-MM-DD
                    lastDate[id] = new Date(row.last_sim_date).toISOString().split('T')[0];

                    logger.info({ school: s.name, method: 'CheckPoint' }, '📦 State restored');
                }
                else {
                    // 3. Fallback to Telemetry (Only for Brand New Schools)
                    // Fix #2: Correctly rehydrate daily counters if checkpoint is missing
                    const tz = s.timezone || 'UTC';
                    const todayDate = DateTime.now().setZone(tz).toISODate()!;

                    // Get latest total AND today's max daily
                    const lt = await query(
                        `SELECT total_energy_kwh, DATE(timestamp) as d
                         FROM telemetry
                         WHERE school_id=$1
                         ORDER BY timestamp DESC LIMIT 1`,
                        [id]
                    );

                    const dailyRes = await query(
                        `SELECT MAX(daily_energy_kwh) as max_daily, MAX(daily_export_kwh) as max_export
                         FROM telemetry
                         WHERE school_id=$1 AND DATE(timestamp AT TIME ZONE $2) = $3::date`,
                        [id, tz, todayDate]
                    );

                    lifetimeEnergy[id] = Number(lt.rows[0]?.total_energy_kwh) || 0;

                    // Restore Daily Logic
                    const lastDataDate = lt.rows[0]?.d ? new Date(lt.rows[0].d).toISOString().split('T')[0] : null;

                    if (lastDataDate === todayDate) {
                        dailyEnergy[id] = Number(dailyRes.rows[0]?.max_daily) || 0;
                        dailyExport[id] = Number(dailyRes.rows[0]?.max_export) || 0;
                        lastDate[id] = todayDate;
                    } else {
                        dailyEnergy[id] = 0;
                        dailyExport[id] = 0;
                        lastDate[id] = todayDate;
                    }

                    dailySelfConsumed[id] = Math.max(0, dailyEnergy[id] - dailyExport[id]);
                    dailyImport[id] = 0; // Reset import for safety as it's less critical to persist exactly without checkpoint

                    // Generate new base load
                    baseLoadBySchool[id] = getBaseLoad(Number(s.total_capacity_kwp) || 5);

                    logger.info({ school: s.name, method: 'Telemetry/Fresh' }, '📦 State initialized (Fallback)');
                }

                // Calculate extra logging info (Sunrise/Sunset) only on success
                const tz = s.timezone || 'UTC';
                const lat = Number(s.latitude) || -6.9;
                const dayOfYear = getDayOfYear(tz);
                const { sunrise, sunset } = getSunriseSunset(lat, dayOfYear);

                success = true;
                break; // Exit retry loop
            }
            catch (err) {
                const delay = 2000 * Math.pow(2, i); // Exponential Backoff
                logger.warn({ attempt: i + 1, delay, school: s.name, err }, '⚠️ DB Seed Failed, Retrying...');
                await wait(delay);
            }
        }

        // 🚨 CRITICAL FAILURE
        if (!success) {
            logger.error({ school: s.name }, '🚨 CRITICAL: Could not seed data. Stopping Simulator.');
            throw new Error('Database Seeding Failed - Integrity Protection');
        }
    }
}

// ═══════════ MIDNIGHT RESET ═══════════
function checkMidnightReset(id: string, tz: string): boolean {
    const today = DateTime.now().setZone(tz).toISODate();

    // First run (or missing state): Initialize without resetting energy
    if (!lastDate[id]) {
        lastDate[id] = today!;
        return false;
    }

    // Day changed: Trigger reset
    if (lastDate[id] !== today) {
        lastDate[id] = today!;
        return true;
    }
    return false;
}

// ═══════════ MAIN TICK ═══════════
async function simulateTick() {
    const schools = await getSchools();

    for (const school of schools) {
        try {
            const id = school.id;
            const tz = school.timezone;
            const lat = Number(school.latitude);

            if (!tz || !lat) {
                logger.warn({ school: school.name }, '⚠️ Missing timezone or latitude, skipping');
                continue;
            }

            // Midnight reset
            if (checkMidnightReset(id, tz)) {
                dailyEnergy[id] = 0;
                dailySelfConsumed[id] = 0;
                dailyExport[id] = 0;
                dailyImport[id] = 0;
                logger.info({ school: school.name }, '🌅 Midnight reset');
            }

            // Weather (1% change = ~16 min stability)
            if (!schoolWeather[id] || Math.random() < 0.01) {
                schoolWeather[id] = getRandomWeather();
            }
            const weather = schoolWeather[id];
            const weatherMult = WEATHER_FACTOR[weather];

            // Time calculation using school's timezone
            const localHour = getLocalHour(tz);
            const dayOfYear = getDayOfYear(tz);

            // Daylight factor based on actual sunrise/sunset for this latitude
            const daylight = daylightFactor(localHour, lat, dayOfYear);
            const irradiance = calcIrradiance(daylight, weatherMult);
            const temp = calcTemperature(daylight);

            // Solar (irradiance-first cutoff - no power below 50 W/m²)
            const capacity = Number(school.total_capacity_kwp) || 5;
            let solar_kw = 0;
            if (irradiance >= 50) {
                // Apply efficiency factor (PR)
                const performance = 0.9 + Math.random() * 0.2; // fluctuation +/- 10%
                solar_kw = +(capacity * daylight * weatherMult * performance * SYSTEM_EFFICIENCY).toFixed(3);
            }

            // Load with night floor (35% minimum)
            const baseLoad = baseLoadBySchool[id] || 3;
            const nightFloor = baseLoad * 0.35;
            let load_kw = Math.max(nightFloor, baseLoad * loadFactor(localHour))
                * (0.97 + Math.random() * 0.06);
            load_kw = +load_kw.toFixed(3);

            // Energy calculations
            const intervalHours = 10 / 3600;
            const produced = solar_kw * intervalHours;
            const selfConsumed = Math.min(solar_kw, load_kw) * intervalHours;
            const exported = Math.max(0, solar_kw - load_kw) * intervalHours;
            const imported = Math.max(0, load_kw - solar_kw) * intervalHours;

            // Accumulate (Strict Monotonic)
            dailySelfConsumed[id] = (dailySelfConsumed[id] || 0) + selfConsumed;
            dailyExport[id] = (dailyExport[id] || 0) + exported;
            dailyImport[id] = (dailyImport[id] || 0) + imported;

            const previousDailyEnergy = dailyEnergy[id] || 0;
            // Energy = Self + Export
            let newDailyEnergy = dailySelfConsumed[id] + dailyExport[id];

            // 🛡️ Fix #1: Strict Monotonicity Guard
            if (newDailyEnergy < previousDailyEnergy) {
                logger.warn({ school: school.name, prev: previousDailyEnergy, new: newDailyEnergy }, '⚠️ Monotonic Violation prevented');
                newDailyEnergy = previousDailyEnergy;
            }

            dailyEnergy[id] = newDailyEnergy;

            // Lifetime Accumulation
            if (produced > 0) {
                lifetimeEnergy[id] = (lifetimeEnergy[id] || 0) + produced;
            }

            // Instantaneous
            const exportKw = +Math.max(0, solar_kw - load_kw).toFixed(3);
            const importKw = +Math.max(0, load_kw - solar_kw).toFixed(3);
            const current = solar_kw > 0 ? (solar_kw * 1000 / (230 * PF)).toFixed(2) : '0.00';

            // Reason for logging
            let reason = 'BALANCED';
            if (exportKw > 0) reason = 'EXPORT';
            if (importKw > 0) reason = 'IMPORT';

            // Get sunrise/sunset for this school
            const { sunrise, sunset } = getSunriseSunset(lat, dayOfYear);

            // Insert to DB
            await query(`
                INSERT INTO telemetry (
                    school_id, timestamp, ac_power_kw, ac_voltage, ac_current,
                    daily_energy_kwh, total_energy_kwh,
                    daily_export_kwh, daily_import_kwh,
                    load_kw, grid_export_kw, grid_import_kw,
                    irradiance_wm2, panel_temp_c, weather_condition
                ) VALUES ($1,NOW(),$2,230,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
            `, [
                id,
                solar_kw,
                current,
                dailyEnergy[id].toFixed(4),
                (lifetimeEnergy[id] || 0).toFixed(4),
                dailyExport[id].toFixed(4),
                dailyImport[id].toFixed(4),
                load_kw,
                exportKw,
                importKw,
                irradiance.toFixed(1),
                temp.toFixed(1),
                weather
            ]);

            // 🔥 SAVE CHECKPOINT (Persistence)
            await query(`
                INSERT INTO simulator_checkpoint (
                    school_id, last_sim_date, last_verified_total_kwh,
                    daily_energy_kwh, daily_export_kwh, daily_import_kwh,
                    base_load_kw, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
                ON CONFLICT (school_id) DO UPDATE SET
                    last_sim_date = EXCLUDED.last_sim_date,
                    last_verified_total_kwh = EXCLUDED.last_verified_total_kwh,
                    daily_energy_kwh = EXCLUDED.daily_energy_kwh,
                    daily_export_kwh = EXCLUDED.daily_export_kwh,
                    daily_import_kwh = EXCLUDED.daily_import_kwh,
                    base_load_kw = EXCLUDED.base_load_kw,
                    updated_at = NOW()
            `, [
                id,
                lastDate[id],
                lifetimeEnergy[id],
                dailyEnergy[id],
                dailyExport[id],
                dailyImport[id],
                baseLoadBySchool[id]
            ]);

            logger.info({
                school: school.name,
                hour: localHour.toFixed(1),
                sunrise: sunrise.toFixed(1),
                sunset: sunset.toFixed(1),
                daylight: daylight.toFixed(2),
                solar: solar_kw,
                load: load_kw,
                irr: irradiance.toFixed(0),
                weather,
                reason
            }, '☀️ Tick');

            // 🔥 Broadcast to Frontend (Fixes "Dashboard not changing")
            broadcastTelemetryUpdate({
                school_id: id,
                timestamp: new Date(),
                ac_power_kw: solar_kw,
                ac_voltage: 230,
                ac_current: Number(current),
                total_energy_kwh: lifetimeEnergy[id],
                daily_energy_kwh: dailyEnergy[id],
                daily_export_kwh: dailyExport[id],
                daily_import_kwh: dailyImport[id],
                load_kw: load_kw,
                grid_export_kw: exportKw,
                grid_import_kw: importKw,
                irradiance_wm2: irradiance,
                panel_temp_c: temp,
                weather_condition: weather,
                performance_ratio: 0.9, // Estimated
                efficiency_percent: 19.5, // Standard Mono Panel
                fault: 'none',
                quality_score: 100
            });

        } catch (err) {
            logger.error({ err, school: school.name }, '❌ Tick failed for school');
        }
    }
}

// ═══════════ START/STOP ═══════════
export async function startSimulator() {
    if (intervalId) {
        logger.warn('⚠️ Simulator already running');
        return;
    }

    logger.info('🚀 Starting time-aware solar simulator...');

    // Seed all state from DB once at startup
    await seedFromDB();

    // Run first tick immediately
    simulateTick().catch(e => logger.error({ err: e }, 'First tick failed'));

    // Then every 10 seconds
    intervalId = setInterval(() => {
        simulateTick().catch(e => logger.error({ err: e }, 'Tick failed'));
    }, 10_000);

    logger.info('✅ Simulator started successfully');
}

export function stopSimulator() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        logger.info('🛑 Simulator stopped');
    }
}
