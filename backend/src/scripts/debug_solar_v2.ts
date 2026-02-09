
import {
    getLocalHour, getDayOfYear,
    daylightFactor, calcIrradiance,
    getSunriseSunset
} from '../utils/solarModels.js';

const schools = [
    { name: 'TEST4 (NZ)', lat: -45.0312, tz: 'Pacific/Auckland' },
    { name: 'Test5 (Honduras)', lat: 14.0723, tz: 'America/Tegucigalpa' }
];

schools.forEach(school => {
    try {
        console.log(`\n--- ${school.name} ---`);
        const hour = getLocalHour(school.tz);
        const day = getDayOfYear(school.tz);
        const { sunrise, sunset } = getSunriseSunset(school.lat, day);
        const daylight = daylightFactor(hour, school.lat, day);

        console.log(`Timezone: ${school.tz}`);
        console.log(`Local Hour: ${hour.toFixed(2)}`);
        console.log(`Sunrise: ${sunrise.toFixed(2)}`);
        console.log(`Sunset: ${sunset.toFixed(2)}`);
        console.log(`Daylight Factor: ${daylight.toFixed(4)}`);

        if (daylight > 0) {
            console.log('STATUS: GENERATING ☀️');
        } else {
            console.log('STATUS: NIGHT 🌙');
        }
    } catch (e) {
        console.error(`Error for ${school.name}:`, e.message);
    }
});
