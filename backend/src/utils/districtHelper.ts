/**
 * District → Timezone & Coordinates Mapping
 * 
 * Uses OpenStreetMap Nominatim API for geocoding (free, no API key required)
 * and a timezone lookup based on coordinates.
 * 
 * For school registration: getDistrictInfoAsync() does live geocoding
 * For simulation (sync): getDistrictInfo() uses cached data
 */

// Logger is optional - use console if not available
const logger = {
    debug: (obj: any, msg?: string) => { },
    info: (obj: any, msg?: string) => console.log(msg, obj),
    warn: (obj: any, msg?: string) => console.warn(msg, obj),
};

export interface DistrictInfo {
    timezone: string;
    latitude: number;
    longitude: number;
}

// ============================================
// TIMEZONE LOOKUP BY COORDINATES
// ============================================

// Approximate timezone boundaries (simplified)
function getTimezoneFromCoords(lat: number, lng: number): string {
    // Western Hemisphere (Americas)
    if (lng < -30) {
        if (lng < -100) {
            // Pacific time
            if (lat > 30) return 'America/Los_Angeles';
            return 'America/Mexico_City';
        }
        if (lng < -60) {
            // Eastern/Central time
            if (lat > 35) return 'America/New_York';
            if (lat > 15) return 'America/Mexico_City';
            return 'America/Tegucigalpa';
        }
        // South America
        if (lat > 0) return 'America/Bogota';
        return 'America/Sao_Paulo';
    }

    // Europe/Africa
    if (lng < 40) {
        if (lat > 35) {
            if (lng < 0) return 'Europe/London';
            if (lng < 15) return 'Europe/Paris';
            return 'Europe/Berlin';
        }
        // Africa
        if (lng < 20) return 'Africa/Lagos';
        return 'Africa/Johannesburg';
    }

    // Asia
    if (lng < 60) {
        // Middle East (Dubai, Saudi, etc)
        if (lat > 12) return 'Asia/Dubai';
        return 'Africa/Nairobi';
    }

    if (lng < 75) {
        // Pakistan / Western India
        if (lat > 20) return 'Asia/Kolkata';
        return 'Asia/Karachi';
    }

    if (lng < 100) {
        // India / Bangladesh / SE Asia west
        return 'Asia/Kolkata';
    }

    if (lng < 115) {
        // Indonesia WIB, Malaysia, Singapore, Thailand, Vietnam
        if (lat > 0) return 'Asia/Bangkok';
        return 'Asia/Jakarta';
    }

    if (lng < 125) {
        // Indonesia WITA, Philippines
        if (lat > 0) return 'Asia/Manila';
        return 'Asia/Makassar';
    }

    if (lng < 145) {
        // Indonesia WIT, Japan, Korea
        if (lat > 30) return 'Asia/Tokyo';
        if (lat > 0) return 'Asia/Tokyo';
        return 'Asia/Jayapura';
    }

    // Oceania
    if (lng < 180) {
        if (lat > -20) return 'Pacific/Auckland';
        if (lat > -35) return 'Australia/Sydney';
        return 'Pacific/Auckland';
    }

    return 'UTC';
}

// ============================================
// KNOWN DISTRICTS (CACHED FOR FAST LOOKUP)
// ============================================

const DISTRICT_DATA: Record<string, DistrictInfo> = {
    // INDIA
    'kurnool': { timezone: 'Asia/Kolkata', latitude: 15.8281, longitude: 78.0373 },
    'hyderabad': { timezone: 'Asia/Kolkata', latitude: 17.3850, longitude: 78.4867 },
    'bangalore': { timezone: 'Asia/Kolkata', latitude: 12.9716, longitude: 77.5946 },
    'mumbai': { timezone: 'Asia/Kolkata', latitude: 19.0760, longitude: 72.8777 },
    'delhi': { timezone: 'Asia/Kolkata', latitude: 28.7041, longitude: 77.1025 },
    'chennai': { timezone: 'Asia/Kolkata', latitude: 13.0827, longitude: 80.2707 },
    'kolkata': { timezone: 'Asia/Kolkata', latitude: 22.5726, longitude: 88.3639 },
    'pune': { timezone: 'Asia/Kolkata', latitude: 18.5204, longitude: 73.8567 },
    'jaipur': { timezone: 'Asia/Kolkata', latitude: 26.9124, longitude: 75.7873 },
    'ahmedabad': { timezone: 'Asia/Kolkata', latitude: 23.0225, longitude: 72.5714 },
    'lucknow': { timezone: 'Asia/Kolkata', latitude: 26.8467, longitude: 80.9462 },
    'noida': { timezone: 'Asia/Kolkata', latitude: 28.5355, longitude: 77.3910 },
    'gurgaon': { timezone: 'Asia/Kolkata', latitude: 28.4595, longitude: 77.0266 },

    // CENTRAL AMERICA
    'honduras': { timezone: 'America/Tegucigalpa', latitude: 14.0723, longitude: -87.1921 },
    'tegucigalpa': { timezone: 'America/Tegucigalpa', latitude: 14.0723, longitude: -87.1921 },
    'san pedro sula': { timezone: 'America/Tegucigalpa', latitude: 15.5000, longitude: -88.0333 },
    'guatemala': { timezone: 'America/Guatemala', latitude: 14.6349, longitude: -90.5069 },
    'el salvador': { timezone: 'America/El_Salvador', latitude: 13.6929, longitude: -89.2182 },
    'costa rica': { timezone: 'America/Costa_Rica', latitude: 9.9281, longitude: -84.0907 },
    'mexico city': { timezone: 'America/Mexico_City', latitude: 19.4326, longitude: -99.1332 },

    // USA EAST
    'new york': { timezone: 'America/New_York', latitude: 40.7128, longitude: -74.0060 },
    'boston': { timezone: 'America/New_York', latitude: 42.3601, longitude: -71.0589 },
    'miami': { timezone: 'America/New_York', latitude: 25.7617, longitude: -80.1918 },
    'atlanta': { timezone: 'America/New_York', latitude: 33.7490, longitude: -84.3880 },
    'washington dc': { timezone: 'America/New_York', latitude: 38.9072, longitude: -77.0369 },
    'philadelphia': { timezone: 'America/New_York', latitude: 39.9526, longitude: -75.1652 },
    'orlando': { timezone: 'America/New_York', latitude: 28.5383, longitude: -81.3792 },

    // USA WEST
    'los angeles': { timezone: 'America/Los_Angeles', latitude: 34.0522, longitude: -118.2437 },
    'san francisco': { timezone: 'America/Los_Angeles', latitude: 37.7749, longitude: -122.4194 },
    'seattle': { timezone: 'America/Los_Angeles', latitude: 47.6062, longitude: -122.3321 },
    'san diego': { timezone: 'America/Los_Angeles', latitude: 32.7157, longitude: -117.1611 },
    'las vegas': { timezone: 'America/Los_Angeles', latitude: 36.1699, longitude: -115.1398 },
    'portland': { timezone: 'America/Los_Angeles', latitude: 45.5152, longitude: -122.6784 },

    // UK
    'london': { timezone: 'Europe/London', latitude: 51.5074, longitude: -0.1278 },
    'manchester': { timezone: 'Europe/London', latitude: 53.4808, longitude: -2.2426 },
    'birmingham': { timezone: 'Europe/London', latitude: 52.4862, longitude: -1.8904 },
    'glasgow': { timezone: 'Europe/London', latitude: 55.8642, longitude: -4.2518 },

    // EUROPE
    'berlin': { timezone: 'Europe/Berlin', latitude: 52.5200, longitude: 13.4050 },
    'paris': { timezone: 'Europe/Paris', latitude: 48.8566, longitude: 2.3522 },
    'amsterdam': { timezone: 'Europe/Amsterdam', latitude: 52.3676, longitude: 4.9041 },
    'madrid': { timezone: 'Europe/Madrid', latitude: 40.4168, longitude: -3.7038 },
    'rome': { timezone: 'Europe/Rome', latitude: 41.9028, longitude: 12.4964 },

    // AUSTRALIA & NEW ZEALAND
    'sydney': { timezone: 'Australia/Sydney', latitude: -33.8688, longitude: 151.2093 },
    'melbourne': { timezone: 'Australia/Melbourne', latitude: -37.8136, longitude: 144.9631 },
    'brisbane': { timezone: 'Australia/Brisbane', latitude: -27.4698, longitude: 153.0251 },
    'perth': { timezone: 'Australia/Perth', latitude: -31.9505, longitude: 115.8605 },
    'adelaide': { timezone: 'Australia/Adelaide', latitude: -34.9285, longitude: 138.6007 },
    'queenstown': { timezone: 'Pacific/Auckland', latitude: -45.0312, longitude: 168.6626 }, // New Zealand!
    'auckland': { timezone: 'Pacific/Auckland', latitude: -36.8485, longitude: 174.7633 },
    'wellington': { timezone: 'Pacific/Auckland', latitude: -41.2865, longitude: 174.7762 },

    // INDONESIA - WIB (UTC+7)
    'jakarta': { timezone: 'Asia/Jakarta', latitude: -6.2088, longitude: 106.8456 },
    'bandung': { timezone: 'Asia/Jakarta', latitude: -6.9175, longitude: 107.6191 },
    'surabaya': { timezone: 'Asia/Jakarta', latitude: -7.2575, longitude: 112.7521 },
    'yogyakarta': { timezone: 'Asia/Jakarta', latitude: -7.7956, longitude: 110.3695 },
    'semarang': { timezone: 'Asia/Jakarta', latitude: -6.9666, longitude: 110.4196 },
    'medan': { timezone: 'Asia/Jakarta', latitude: 3.5952, longitude: 98.6722 },

    // INDONESIA - WITA (UTC+8)
    'bali': { timezone: 'Asia/Makassar', latitude: -8.4095, longitude: 115.1889 },
    'denpasar': { timezone: 'Asia/Makassar', latitude: -8.6705, longitude: 115.2126 },
    'makassar': { timezone: 'Asia/Makassar', latitude: -5.1477, longitude: 119.4327 },
    'balikpapan': { timezone: 'Asia/Makassar', latitude: -1.2654, longitude: 116.8312 },

    // INDONESIA - WIT (UTC+9)
    'jayapura': { timezone: 'Asia/Jayapura', latitude: -2.5916, longitude: 140.6690 },
    'ambon': { timezone: 'Asia/Jayapura', latitude: -3.6954, longitude: 128.1814 },
};

// ============================================
// GEOCODING API (ASYNC - for registration)
// ============================================

/**
 * Geocode a district name using OpenStreetMap Nominatim API
 * Returns coordinates and derives timezone from them
 */
export async function getDistrictInfoAsync(district: string): Promise<DistrictInfo> {
    if (!district || district.trim() === '') {
        return { timezone: 'UTC', latitude: 0, longitude: 0 };
    }

    const d = district.toLowerCase().trim();

    // Check cache first
    if (DISTRICT_DATA[d]) {
        logger.debug({ district: d, cached: true }, '📍 District found in cache');
        return DISTRICT_DATA[d];
    }

    // Partial match in cache
    for (const [key, info] of Object.entries(DISTRICT_DATA)) {
        if (d.includes(key) || key.includes(d)) {
            logger.debug({ district: d, matched: key }, '📍 District matched in cache');
            return info;
        }
    }

    // Use Nominatim API for geocoding
    try {
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(district)}&format=json&limit=1`;

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PowerTrack/1.0 (Solar Monitoring Platform)'
            }
        });

        if (!response.ok) {
            throw new Error(`Geocoding API error: ${response.status}`);
        }

        const data = await response.json() as Array<{ lat: string; lon: string; display_name: string }>;

        if (data.length > 0) {
            const lat = parseFloat(data[0].lat);
            const lng = parseFloat(data[0].lon);
            const timezone = getTimezoneFromCoords(lat, lng);

            logger.info({
                district,
                latitude: lat.toFixed(4),
                longitude: lng.toFixed(4),
                timezone,
                geocoded: data[0].display_name
            }, '🌍 Geocoded district dynamically');

            // Cache for future use
            DISTRICT_DATA[d] = { timezone, latitude: lat, longitude: lng };

            return { timezone, latitude: lat, longitude: lng };
        }
    } catch (error) {
        logger.warn({ district, error: (error as Error).message }, '⚠️ Geocoding failed, using fallback');
    }

    // Fallback to UTC with 0,0 coordinates
    logger.warn({ district }, '⚠️ Unknown district, using UTC fallback');
    return { timezone: 'UTC', latitude: 0, longitude: 0 };
}

// ============================================
// SYNC FUNCTIONS (for simulation/fast lookup)
// ============================================

/**
 * Get district info synchronously (uses cache only)
 * For simulation where we can't do async calls
 */
export function getDistrictInfo(district: string): DistrictInfo {
    if (!district || district.trim() === '') {
        return { timezone: 'UTC', latitude: 0, longitude: 0 };
    }

    const d = district.toLowerCase().trim();

    // Check exact match
    if (DISTRICT_DATA[d]) {
        return DISTRICT_DATA[d];
    }

    // Check partial match
    for (const [key, info] of Object.entries(DISTRICT_DATA)) {
        if (d.includes(key) || key.includes(d)) {
            return info;
        }
    }

    // WARNING: Unknown district - log it so we can see the problem
    console.warn(`⚠️ Unknown district: "${district}" - no timezone/coordinates available`);

    return { timezone: 'UTC', latitude: 0, longitude: 0 };
}

/**
 * Get only timezone
 */
export function getTimezoneForDistrict(district: string): string {
    return getDistrictInfo(district).timezone;
}

/**
 * Get only coordinates
 */
export function getCoordinatesForDistrict(district: string): { latitude: number; longitude: number } {
    const info = getDistrictInfo(district);
    return { latitude: info.latitude, longitude: info.longitude };
}
