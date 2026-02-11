import { query } from './db/index.js';
import { logger } from './utils/logger.js';
import { broadcastTelemetryUpdate } from './websocket/index.js';
import { DateTime } from 'luxon';
import { SIMULATION, WEATHER_FACTOR, ENVIRONMENTAL } from './config/constants.js';

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

// Track daily energy per school (resets at midnight in school's timezone)
interface SchoolState {
    dailyEnergy: number;
    totalEnergy: number;
    lastUpdateDate: string; // YYYY-MM-DD in school's timezone
    currentWeather: string;
}

const schoolState: Map<string, SchoolState> = new Map();

// ═══════════ UTILITY FUNCTIONS ═══════════

/**
 * Calculate sunrise and sunset times for a given latitude and day of year
 */
function getSunriseSunset(latitude: number, dayOfYear: number): { sunrise: number; sunset: number } {
    const latRad = (latitude * Math.PI) / 180;
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
    const decRad = (declination * Math.PI) / 180;
    const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);

    // Handle polar extremes
    if (cosHourAngle < -1) return { sunrise: 0, sunset: 24 };
    if (cosHourAngle > 1) return { sunrise: 12, sunset: 12 };

    const hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI) / 15;
    const solarNoon = 12;

    return {
        sunrise: solarNoon - hourAngle,
        sunset: solarNoon + hourAngle
    };
}

/**
 * Calculate solar power output based on time of day
 * Returns power in kW
 */
function calculateSolarPower(
    capacityKwp: number,
    localHour: number,
    latitude: number,
    dayOfYear: number,
    weatherCondition: string
): { powerKw: number; irradiance: number; temperature: number } {
    const { sunrise, sunset } = getSunriseSunset(latitude, dayOfYear);

    // Night time - no power
    if (localHour < sunrise || localHour > sunset) {
        return { powerKw: 0, irradiance: 0, temperature: 20 };
    }

    // Calculate position in the day (0 at sunrise, 1 at solar noon, 0 at sunset)
    const dayLength = sunset - sunrise;
    const solarNoon = (sunrise + sunset) / 2;
    const timeSinceNoon = localHour - solarNoon;

    // Sinusoidal curve: peaks at noon, zero at sunrise/sunset
    const daylightFactor = Math.cos((timeSinceNoon / (dayLength / 2)) * (Math.PI / 2));
    const normalizedDaylight = Math.max(0, daylightFactor);

    // Add heat effect - power increases with temperature during the day
    // Peak heat is around 2-3 PM (1-2 hours after solar noon)
    const hoursSinceSunrise = localHour - sunrise;
    const peakHeatHour = dayLength * 0.65; // About 65% through the day
    const heatFactor = 1 - Math.abs(hoursSinceSunrise - peakHeatHour) / (dayLength / 2);
    const heatBoost = Math.max(0, heatFactor * 0.05); // Up to 5% boost from heat

    // Calculate irradiance
    const weatherMultiplier = WEATHER_FACTOR[weatherCondition] || 1.0;
    const irradiance = SIMULATION.PEAK_IRRADIANCE * normalizedDaylight * weatherMultiplier;

    // Only generate power if irradiance is above threshold
    if (irradiance < SIMULATION.MIN_IRRADIANCE_THRESHOLD) {
        return { powerKw: 0, irradiance: 0, temperature: 20 };
    }

    // Temperature calculation (panels heat up with sun exposure)
    const temperature = SIMULATION.PANEL_AMBIENT_TEMP + (normalizedDaylight * SIMULATION.PANEL_TEMP_RISE);

    // Power calculation with heat boost
    const basePower = capacityKwp * normalizedDaylight * weatherMultiplier * SIMULATION.SYSTEM_EFFICIENCY;
    const powerKw = basePower * (1 + heatBoost);

    return {
        powerKw: Number(powerKw.toFixed(3)),
        irradiance: Number(irradiance.toFixed(1)),
        temperature: Number(temperature.toFixed(1))
    };
}

/**
 * Get random weather condition based on probability distribution
 */
function getRandomWeather(): string {
    const r = Math.random();
    if (r < SIMULATION.WEATHER_SUNNY_PROB) return 'sunny';
    if (r < SIMULATION.WEATHER_PARTLY_CLOUDY_PROB) return 'partly_cloudy';
    if (r < SIMULATION.WEATHER_CLOUDY_PROB) return 'cloudy';
    return 'rainy';
}

/**
 * Calculate AC current from power
 */
function calculateCurrent(powerKw: number): number {
    if (powerKw === 0) return 0;
    return Number((powerKw * 1000 / (SIMULATION.AC_VOLTAGE * SIMULATION.POWER_FACTOR)).toFixed(2));
}

// ═══════════ SCHOOL CACHE ═══════════
async function getSchools(): Promise<School[]> {
    const now = Date.now();
    if (now - lastFetch > SIMULATION.CACHE_TTL_MS || schoolsCache.length === 0) {
        const res = await query(`
            SELECT id, name, timezone, latitude, longitude, total_capacity_kwp
            FROM schools 
            WHERE deleted_at IS NULL 
            AND timezone IS NOT NULL
            AND latitude IS NOT NULL 
            AND longitude IS NOT NULL
            AND total_capacity_kwp > 0
        `);

        schoolsCache = res.rows;
        lastFetch = now;
        logger.info({ count: schoolsCache.length }, '📦 Schools cache refreshed');

        // Validate school data
        for (const school of schoolsCache) {
            if (!school.timezone) {
                logger.error({ schoolId: school.id, schoolName: school.name },
                    '❌ School missing timezone - skipping from simulation');
            }
        }
    }
    return schoolsCache;
}

export function invalidateSchoolCache() {
    lastFetch = 0;
    schoolsCache = [];
    logger.info('🔄 School cache invalidated');
}

// ═══════════ STATE INITIALIZATION ═══════════
async function initializeState() {
    const schools = await getSchools();
    logger.info('🌱 Initializing simulation state...');

    for (const school of schools) {
        if (!school.timezone) {
            logger.warn({ schoolId: school.id }, '⚠️ Skipping school without timezone');
            continue;
        }

        try {
            // Get latest telemetry from database
            const res = await query(`
                SELECT total_energy_kwh, daily_energy_kwh, timestamp
                FROM telemetry 
                WHERE school_id = $1 
                ORDER BY timestamp DESC 
                LIMIT 1
            `, [school.id]);

            const row = res.rows[0];
            const nowInSchoolTz = DateTime.now().setZone(school.timezone);
            const currentDate = nowInSchoolTz.toISODate();

            let dailyEnergy = 0;
            let totalEnergy = 0;

            if (row) {
                const lastUpdate = DateTime.fromJSDate(new Date(row.timestamp)).setZone(school.timezone);
                const lastDate = lastUpdate.toISODate();

                // If same day, resume counting; otherwise reset daily
                if (lastDate === currentDate) {
                    dailyEnergy = Number(row.daily_energy_kwh) || 0;
                }
                totalEnergy = Number(row.total_energy_kwh) || 0;

                logger.info({
                    school: school.name,
                    lastDate,
                    currentDate,
                    resuming: lastDate === currentDate
                }, '📊 Loaded state from database');
            }

            schoolState.set(school.id, {
                dailyEnergy,
                totalEnergy,
                lastUpdateDate: currentDate!,
                currentWeather: getRandomWeather()
            });

        } catch (err) {
            logger.error({ school: school.name, err }, '❌ Failed to initialize state');
            // Initialize with zeros
            const nowInSchoolTz = DateTime.now().setZone(school.timezone);
            schoolState.set(school.id, {
                dailyEnergy: 0,
                totalEnergy: 0,
                lastUpdateDate: nowInSchoolTz.toISODate()!,
                currentWeather: getRandomWeather()
            });
        }
    }

    logger.info({ schoolCount: schoolState.size }, '✅ State initialized');
}

// ═══════════ MAIN SIMULATION TICK ═══════════
async function simulateTick() {
    const schools = await getSchools();
    const tickTimestamp = new Date();

    for (const school of schools) {
        if (!school.timezone) {
            logger.warn({ schoolId: school.id }, '⚠️ Skipping school without timezone');
            continue;
        }

        try {
            const state = schoolState.get(school.id);
            if (!state) {
                logger.warn({ schoolId: school.id }, '⚠️ State not initialized, skipping');
                continue;
            }

            // Get current time in school's timezone
            const nowInSchoolTz = DateTime.fromJSDate(tickTimestamp).setZone(school.timezone);
            const currentDate = nowInSchoolTz.toISODate()!;
            const localHour = nowInSchoolTz.hour + nowInSchoolTz.minute / 60 + nowInSchoolTz.second / 3600;
            const dayOfYear = nowInSchoolTz.ordinal;

            // Check for day rollover (midnight crossing)
            if (currentDate !== state.lastUpdateDate) {
                logger.info({
                    school: school.name,
                    oldDate: state.lastUpdateDate,
                    newDate: currentDate,
                    dailyEnergy: state.dailyEnergy.toFixed(3)
                }, '🌙 Midnight detected - resetting daily counters');

                state.dailyEnergy = 0;
                state.lastUpdateDate = currentDate;
            }

            // Weather changes occasionally
            if (Math.random() < SIMULATION.WEATHER_CHANGE_PROBABILITY) {
                state.currentWeather = getRandomWeather();
                logger.debug({ school: school.name, weather: state.currentWeather }, '☁️ Weather changed');
            }

            // Calculate solar power output
            const { powerKw, irradiance, temperature } = calculateSolarPower(
                school.total_capacity_kwp,
                localHour,
                school.latitude,
                dayOfYear,
                state.currentWeather
            );

            // Calculate energy increment (power * time)
            // Time delta is the tick interval in hours
            const deltaHours = SIMULATION.TICK_INTERVAL_MS / 3600000;
            const energyKwh = powerKw * deltaHours;

            // Update state (in-memory)
            const newDailyEnergy = state.dailyEnergy + energyKwh;
            const newTotalEnergy = state.totalEnergy + energyKwh;

            // Calculate AC current
            const current = calculateCurrent(powerKw);

            // Persist to database
            try {
                await query(`
                    INSERT INTO telemetry (
                        school_id, timestamp, 
                        ac_power_kw, ac_voltage, ac_current,
                        daily_energy_kwh, total_energy_kwh,
                        irradiance_wm2, panel_temp_c, weather_condition
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                `, [
                    school.id,
                    tickTimestamp,
                    powerKw,
                    SIMULATION.AC_VOLTAGE,
                    current,
                    newDailyEnergy.toFixed(4),
                    newTotalEnergy.toFixed(4),
                    irradiance,
                    temperature,
                    state.currentWeather
                ]);

                // Only update state after successful DB write
                state.dailyEnergy = newDailyEnergy;
                state.totalEnergy = newTotalEnergy;

                logger.info({
                    school: school.name,
                    localTime: localHour.toFixed(2),
                    power: powerKw,
                    daily: newDailyEnergy.toFixed(3),
                    total: newTotalEnergy.toFixed(2),
                    weather: state.currentWeather
                }, '☀️ Tick');

                // Broadcast to WebSocket clients
                broadcastTelemetryUpdate({
                    school_id: school.id,
                    timestamp: tickTimestamp,
                    ac_power_kw: powerKw,
                    ac_voltage: SIMULATION.AC_VOLTAGE,
                    ac_current: current,
                    total_energy_kwh: newTotalEnergy,
                    daily_energy_kwh: newDailyEnergy,
                    irradiance_wm2: irradiance,
                    panel_temp_c: temperature,
                    weather_condition: state.currentWeather,
                    performance_ratio: 0.9,
                    efficiency_percent: 19.5,
                    fault: 'none',
                    quality_score: 100
                });

            } catch (dbError) {
                logger.error({ school: school.name, dbError }, '❌ Database write failed - state not updated');
            }

        } catch (err) {
            logger.error({ school: school.name, err }, '❌ Simulation tick failed');
        }
    }
}

// ═══════════ START/STOP ═══════════
let advisoryLockHeld = false;

export async function startSimulator() {
    if (intervalId) {
        logger.warn('⚠️ Simulator already running');
        return;
    }

    // Acquire advisory lock to prevent duplicate instances
    try {
        const lockResult = await query(`SELECT pg_try_advisory_lock($1)`, [SIMULATION.ADVISORY_LOCK_ID]);
        advisoryLockHeld = lockResult.rows[0].pg_try_advisory_lock;

        if (!advisoryLockHeld) {
            const errorMsg = 'Another simulator instance is already running';
            logger.error(errorMsg);
            throw new Error(errorMsg);
        }

        logger.info('🔒 Acquired simulator advisory lock');
    } catch (err) {
        logger.error({ err }, '❌ Failed to acquire simulator lock');
        throw err;
    }

    logger.info({
        interval: SIMULATION.TICK_INTERVAL_MS,
        cacheTtl: SIMULATION.CACHE_TTL_MS
    }, '🚀 Starting simplified simulator...');

    await initializeState();

    // Run first tick immediately
    simulateTick();

    // Then continue on intervals
    intervalId = setInterval(simulateTick, SIMULATION.TICK_INTERVAL_MS);
}

export function stopSimulator() {
    if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;

        // Release advisory lock
        if (advisoryLockHeld) {
            query(`SELECT pg_advisory_unlock($1)`, [SIMULATION.ADVISORY_LOCK_ID])
                .then(() => logger.info('🔓 Released simulator advisory lock'))
                .catch(err => logger.error({ err }, '❌ Failed to release lock'));
            advisoryLockHeld = false;
        }

        logger.info('🛑 Simulator stopped');
    }
}
