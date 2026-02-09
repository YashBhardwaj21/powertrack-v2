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
