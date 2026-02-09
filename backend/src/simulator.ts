import { query } from './db/index.js';
import { logger } from './utils/logger.js';
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
async function seedFromDB() {
    const schools = await getSchools();

    for (const s of schools) {
        const id = s.id;

        // Seed lifetime from last telemetry
        try {
            const res = await query(
                `SELECT total_energy_kwh FROM telemetry 
                 WHERE school_id=$1 ORDER BY timestamp DESC LIMIT 1`,
                [id]
            );
            lifetimeEnergy[id] = Number(res.rows[0]?.total_energy_kwh) || 0;
        } catch {
            lifetimeEnergy[id] = 0;
        }

        // Seed daily from today's data
        try {
            const res = await query(`
                SELECT 
                    MAX(daily_energy_kwh) as de,
                    MAX(daily_export_kwh) as ex,
                    MAX(daily_import_kwh) as im
                FROM telemetry
                WHERE school_id=$1 AND DATE(timestamp)=CURRENT_DATE
            `, [id]);
            dailyEnergy[id] = Number(res.rows[0]?.de) || 0;
            dailyExport[id] = Number(res.rows[0]?.ex) || 0;
            dailyImport[id] = Number(res.rows[0]?.im) || 0;
        } catch {
            dailyEnergy[id] = 0;
            dailyExport[id] = 0;
            dailyImport[id] = 0;
        }

        // Generate stable base load for this school
        baseLoadBySchool[id] = getBaseLoad(Number(s.total_capacity_kwp) || 5);

        // Calculate sunrise/sunset for logging
        const lat = Number(s.latitude) || -6.9;
        const tz = s.timezone;
        if (!tz) {
            logger.warn({ school: s.name }, '⚠️ No timezone set, skipping');
            continue;
        }
        const dayOfYear = getDayOfYear(tz);
        const { sunrise, sunset } = getSunriseSunset(lat, dayOfYear);

        logger.info({
            school: s.name,
            latitude: lat.toFixed(2),
            sunrise: sunrise.toFixed(2),
            sunset: sunset.toFixed(2),
            lifetime: lifetimeEnergy[id].toFixed(2),
            baseLoad: baseLoadBySchool[id].toFixed(2)
        }, '📦 Seeded state');
    }
}

// ═══════════ MIDNIGHT RESET ═══════════
function checkMidnightReset(id: string, tz: string): boolean {
    const today = new Date().toISOString().split('T')[0];

    if (lastDate[id] !== today) {
        lastDate[id] = today;
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
            const exported = Math.max(0, solar_kw - load_kw) * intervalHours;
            const imported = Math.max(0, load_kw - solar_kw) * intervalHours;

            // Accumulate (initialize if needed)
            dailyEnergy[id] = (dailyEnergy[id] || 0) + produced;
            dailyExport[id] = (dailyExport[id] || 0) + exported;
            dailyImport[id] = (dailyImport[id] || 0) + imported;

            // Lifetime only when solar > 0
            if (solar_kw > 0) {
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
