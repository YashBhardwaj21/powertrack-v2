import { DateTime } from 'luxon';

// ═══════════ WEATHER ═══════════
// Match frontend WEATHER_ICONS: sunny, partly_cloudy, cloudy, rainy
export const WEATHER_FACTOR: Record<string, number> = {
    sunny: 1.0,
    partly_cloudy: 0.7,
    cloudy: 0.4,
    rainy: 0.15
};

export function getRandomWeather(): string {
    const r = Math.random();
    if (r < 0.55) return 'sunny';
    if (r < 0.75) return 'partly_cloudy';
    if (r < 0.90) return 'cloudy';
    return 'rainy';
}

// ═══════════ TIME ═══════════
export function getLocalHour(tz: string): number {
    const dt = DateTime.now().setZone(tz);
    return dt.hour + dt.minute / 60;
}

export function getDayOfYear(tz: string): number {
    const dt = DateTime.now().setZone(tz);
    return dt.ordinal; // 1-365
}

// ═══════════ SUNRISE/SUNSET CALCULATION ═══════════
/**
 * Calculate sunrise and sunset hours based on latitude and day of year.
 * Uses simplified astronomical formula (accurate within ~15 min).
 */
export function getSunriseSunset(latitude: number, dayOfYear: number): { sunrise: number; sunset: number } {
    // Convert latitude to radians
    const latRad = (latitude * Math.PI) / 180;

    // Solar declination (simplified formula)
    const declination = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 81));
    const decRad = (declination * Math.PI) / 180;

    // Hour angle at sunrise/sunset
    const cosHourAngle = -Math.tan(latRad) * Math.tan(decRad);

    // Handle polar day/night
    if (cosHourAngle < -1) {
        // Midnight sun (polar day)
        return { sunrise: 0, sunset: 24 };
    }
    if (cosHourAngle > 1) {
        // Polar night
        return { sunrise: 12, sunset: 12 };
    }

    const hourAngle = Math.acos(cosHourAngle) * (180 / Math.PI) / 15; // Convert to hours

    const solarNoon = 12; // Simplified - actual varies by longitude

    return {
        sunrise: solarNoon - hourAngle,
        sunset: solarNoon + hourAngle
    };
}

/**
 * Calculate daylight factor based on actual sun position.
 * Returns 0-1 where 0 = night, 1 = solar noon peak.
 */
export function daylightFactor(localHour: number, latitude: number, dayOfYear: number): number {
    const { sunrise, sunset } = getSunriseSunset(latitude, dayOfYear);

    // Night - sun is down
    if (localHour < sunrise || localHour > sunset) {
        return 0;
    }

    // Calculate solar elevation (simplified sinusoidal curve)
    const dayLength = sunset - sunrise;
    const solarNoon = (sunrise + sunset) / 2;
    const timeSinceNoon = localHour - solarNoon;

    // Sinusoidal curve: peaks at solar noon, 0 at sunrise/sunset
    const factor = Math.cos((timeSinceNoon / (dayLength / 2)) * (Math.PI / 2));

    return Math.max(0, factor);
}

/**
 * Clear-sky irradiance with weather factor and time-of-day.
 * Returns W/m² (max ~1000 at noon on clear day).
 */
export function calcIrradiance(daylightFactor: number, weatherMult: number): number {
    const peakIrradiance = 1000; // W/m² at solar noon, clear sky
    return peakIrradiance * daylightFactor * weatherMult * (0.95 + Math.random() * 0.1);
}

/**
 * Panel temperature based on irradiance.
 * Returns °C.
 */
export function calcTemperature(daylightFactor: number): number {
    const ambientTemp = 25; // Base ambient
    const irradianceHeating = daylightFactor * 15; // Panels heat up with sun
    return ambientTemp + irradianceHeating + (Math.random() * 3 - 1.5);
}

// ═══════════ LOAD MODEL ═══════════
/**
 * Base load by facility size (kW).
 */
export function getBaseLoad(capacityKwp: number): number {
    if (capacityKwp < 5) return 1.5 + Math.random() * 1.5;
    if (capacityKwp < 10) return 2 + Math.random() * 2;
    if (capacityKwp < 25) return 5 + Math.random() * 5;
    return 8 + Math.random() * 10;
}

/**
 * Time-based load multiplier for school activity patterns.
 */
export function loadFactor(hour: number): number {
    if (hour < 6) return 0.3;
    if (hour < 8) return 0.6;
    if (hour < 9) return 0.9;
    if (hour < 15) return 1.0;
    if (hour < 18) return 0.8;
    if (hour < 21) return 0.6;
    return 0.4;
}

// ═══════════ STATELESS ENERGY CALCULATION ═══════════
/**
 * Calculates how much energy a system *should* have produced/exported by a given time of day.
 * This integrates the solar curve AND load curve from Sunrise to CurrentTime.
 */
/**
 * Calculates how much energy a system *should* have produced/exported by a given time of day.
 * This integrates the solar curve AND load curve from Sunrise to CurrentTime.
 * Uses a small step size for precision + partial step for exact time handling.
 */
export function calculateEnergyForTime(
    hour: number,
    capacityKw: number,
    lat: number,
    dayOfYear: number,
    weather: string
) {
    const { sunrise, sunset } = getSunriseSunset(lat, dayOfYear);

    // 1. If before sunrise, 0 energy
    if (hour < sunrise) return { produced: 0, exported: 0, imported: 0, selfConsumed: 0 };

    // 2. If after sunset, we just take the full day's production (calculated at sunset)
    const effectiveHour = Math.min(hour, sunset);

    // 3. Integration (Riemann Sum with Partial Step)
    let totalGeneratedKwh = 0;
    let totalExportedKwh = 0;
    let totalImportedKwh = 0;
    let totalSelfConsumedKwh = 0;

    const baseLoad = getBaseLoad(capacityKw); // Deterministic load baseline
    const stepSizeHours = 0.05; // 3 minutes standard step

    let t = sunrise;
    while (t < effectiveHour) {
        // Determine the size of *this* step (standard or partial remainder)
        const currentStepSize = Math.min(stepSizeHours, effectiveHour - t);

        // Use midpoint for better accuracy, or just start point
        const evalTime = t + (currentStepSize / 2);

        const daylight = daylightFactor(evalTime, lat, dayOfYear);
        const irradiance = calcIrradiance(daylight, 1.0); // Weather applied later scaling

        // Power Generation (kW)
        const efficiency = 0.85;
        const solarKw = (capacityKw * (irradiance / 1000) * efficiency);

        // Load Consumption (kW)
        const currentLoadKw = Math.max(baseLoad * 0.35, baseLoad * loadFactor(evalTime));

        // Energy Steps (kWh)
        const energyStep = solarKw * currentStepSize;
        const loadStep = currentLoadKw * currentStepSize;

        // Instantaneous Flow
        const selfConsumedStep = Math.min(energyStep, loadStep);
        const exportedStep = Math.max(0, energyStep - loadStep);
        const importedStep = Math.max(0, loadStep - energyStep);

        totalGeneratedKwh += energyStep;
        totalExportedKwh += exportedStep;
        totalImportedKwh += importedStep;
        totalSelfConsumedKwh += selfConsumedStep;

        t += currentStepSize;
    }

    // Apply Weather Factor globally for the day
    const weatherMult = WEATHER_FACTOR[weather] || 1.0;

    // Solar is affected by weather, Load is usually not (or less so)
    return {
        produced: Number((totalGeneratedKwh * weatherMult).toFixed(4)),
        exported: Number((totalExportedKwh * weatherMult).toFixed(4)), // Export scales with gen
        imported: Number(totalImportedKwh.toFixed(4)), // Import might actually increase if solar drops? Simplifying for 'stateless'
        selfConsumed: Number((totalSelfConsumedKwh * weatherMult).toFixed(4))
    };
}
