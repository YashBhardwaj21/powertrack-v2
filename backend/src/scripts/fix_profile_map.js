
import { query } from '../db/index.js';

async function main() {
    try {
        // Update the field map to match what simulation sends (total_kwh)
        await query(`
            UPDATE public.device_profiles 
            SET field_map = '{
                "energy_today": "daily_kwh",
                "energy_total": "total_kwh",
                "power": "power_w",
                "voltage": "voltage",
                "current": "current_a"
            }'
            WHERE name = 'PowerTrack Standard'
        `);
        console.log('Updated PowerTrack Standard profile field_map');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
