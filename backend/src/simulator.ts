import { query } from './db/index.js';
import { logger } from './utils/logger.js';
import { broadcastTelemetryUpdate } from './websocket/index.js';
import { DateTime } from 'luxon';
import {
    getLocalHour, getDayOfYear,
    daylightFactor, calcIrradiance, calcTemperature,
    getSunriseSunset,
    getBaseLoad, loadFactor,
    getRandomWeather, WEATHER_FACTOR,
    calculateEnergyForTime // New stateless function
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
const CACHE_TTL = process.env.NODE_ENV === 'development' ? 60_000 : 600_000;

// Baseline History (Energy produced BEFORE today)
const lifetimeHistoryBaseline: Record<string, number> = {};
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

// ═══════════ STARTUP (Stateless) ═══════════
async function seedFromDB() {
    const schools = await getSchools();
    logger.info('🌱 Hydrating Baseline History (Stateless Mode)...');

    for (const s of schools) {
        const id = s.id;
        try {
            // Get Total Energy recorded up to YESTERDAY
            // If we just ask for "MAX(total_energy_kwh)", we get today's value which might be from a previous run.
            // But we want "What was the total BEFORE this morning?" so we add Today's Calculated to it.
            // Actually, safest stateless approach:
            // Baseline = Max Total Energy found in `telemetry_daily` (Aggr History)
            const res = await query(`
                SELECT COALESCE(SUM(daily_energy_kwh), 0) as historic_total 
                FROM telemetry_daily 
                WHERE school_id = $1
            `, [id]);

            lifetimeHistoryBaseline[id] = Number(res.rows[0]?.historic_total) || 0;

            // Initial weather
            schoolWeather[id] = getRandomWeather();
        } catch (err) {
            logger.warn({ school: s.name, err }, '⚠️ Failed to load history, assuming 0 baseline');
            lifetimeHistoryBaseline[id] = 0;
        }
    }
    logger.info('✅ Baseline loaded. Simulator is ready.');
}

// ═══════════ MAIN TICK ═══════════
async function simulateTick() {
    const schools = await getSchools();

    for (const school of schools) {
        try {
            const id = school.id;
            const tz = school.timezone || 'Asia/Jakarta';
            const lat = Number(school.latitude) || -6.2;
            const capacity = Number(school.total_capacity_kwp) || 5;

            // 1. Time & Weather
            if (!schoolWeather[id] || Math.random() < 0.01) {
                schoolWeather[id] = getRandomWeather();
            }
            const weather = schoolWeather[id];
            const weatherMult = WEATHER_FACTOR[weather];

            const localHour = getLocalHour(tz);
            const dayOfYear = getDayOfYear(tz);

            // 2. Instantaneous Values (Live jiggle)
            const daylight = daylightFactor(localHour, lat, dayOfYear);
            const irradiance = calcIrradiance(daylight, weatherMult);
            const temp = calcTemperature(daylight);

            let solar_kw = 0;
            if (irradiance >= 50) {
                const performance = 0.9 + Math.random() * 0.1;
                solar_kw = +(capacity * daylight * weatherMult * performance * SYSTEM_EFFICIENCY).toFixed(3);
            }

            const baseLoad = getBaseLoad(capacity);
            const load_kw = +(Math.max(baseLoad * 0.35, baseLoad * loadFactor(localHour)) * (0.95 + Math.random() * 0.1)).toFixed(3);

            const exportKw = +Math.max(0, solar_kw - load_kw).toFixed(3);
            const importKw = +Math.max(0, load_kw - solar_kw).toFixed(3);
            const current = solar_kw > 0 ? (solar_kw * 1000 / (230 * PF)).toFixed(2) : '0.00';

            // 3. Cumulative Values (Deterministic Calculation)
            // Ask: "How much SHOULD we have produced by now?"
            const stats = calculateEnergyForTime(localHour, capacity, lat, dayOfYear, weather);

            // Total = History (Static) + Today (Dynamic)
            const totalEnergy = (lifetimeHistoryBaseline[id] || 0) + stats.produced;

            // 4. Persistence & Broadcast
            // Note: We NO LONGER save to simulator_checkpoint.
            // We just log to telemetry.

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
                stats.produced.toFixed(4),
                totalEnergy.toFixed(4),
                stats.exported.toFixed(4),
                stats.imported.toFixed(4),
                load_kw,
                exportKw,
                importKw,
                irradiance.toFixed(1),
                temp.toFixed(1),
                weather
            ]);

            logger.info({
                school: school.name,
                time: localHour.toFixed(2),
                solar: solar_kw,
                daily: stats.produced,
                total: totalEnergy
            }, '☀️ Tick');

            broadcastTelemetryUpdate({
                school_id: id,
                timestamp: new Date(),
                ac_power_kw: solar_kw,
                ac_voltage: 230,
                ac_current: Number(current),
                total_energy_kwh: totalEnergy,
                daily_energy_kwh: stats.produced,
                daily_export_kwh: stats.exported,
                daily_import_kwh: stats.imported,
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

        } catch (err) {
            logger.error({ err, school: school.name }, '❌ Tick failed');
        }
    }
}

// ═══════════ START/STOP ═══════════
export async function startSimulator() {
    if (intervalId) return;
    logger.info('🚀 Starting STATELESS simulator...');
    await seedFromDB();
    simulateTick();
    intervalId = setInterval(simulateTick, 10_000);
}

export function stopSimulator() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        logger.info('🛑 Simulator stopped');
    }
}
