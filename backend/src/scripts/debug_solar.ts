
import SunCalc from 'suncalc';

const schools = [
    { name: 'TEST4 (NZ)', lat: -45.0312, lon: 168.6626, tz: 'Pacific/Auckland' },
    { name: 'Test5 (Honduras)', lat: 14.0723, lon: -87.1921, tz: 'America/Tegucigalpa' }
];

console.log('Current Server Time (IST):', new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

schools.forEach(school => {
    // Current time in target timezone
    const now = new Date();
    const localTime = now.toLocaleString('en-US', { timeZone: school.tz });
    console.log(`\n--- ${school.name} ---`);
    console.log(`Local Time: ${localTime}`);

    // Sun position
    const times = SunCalc.getTimes(now, school.lat, school.lon);
    console.log(`Sunrise: ${times.sunrise.toLocaleTimeString('en-US', { timeZone: school.tz })}`);
    console.log(`Sunset: ${times.sunset.toLocaleTimeString('en-US', { timeZone: school.tz })}`);

    // Position
    const sunPos = SunCalc.getPosition(now, school.lat, school.lon);
    const altitude = sunPos.altitude * (180 / Math.PI);
    console.log(`Sun Altitude: ${altitude.toFixed(2)} degrees`);

    // Irradiance Hack (from simulator.ts)
    const MAX_IRRADIANCE = 1000;
    let factor = Math.max(0, Math.sin(sunPos.altitude)); // Simplified
    if (altitude < 0) factor = 0;

    console.log(`Theoretical Irradiance Factor: ${factor.toFixed(2)}`);
    console.log(`Expected Output: ${factor > 0 ? 'GENERATING' : 'ZERO'}`);
});
