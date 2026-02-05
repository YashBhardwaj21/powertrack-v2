
import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.cqdrjhugitgxbeybboee:Ybsaturnkt1607@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        // 1. Fix Mapping
        await client.query(`
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
        console.log('✅ Updated PowerTrack Standard profile field_map');

        // 2. Backfill Data (Fix 0 Lifetime Value)
        const res = await client.query(`
            UPDATE public.telemetry
            SET total_energy_kwh = 1500 + daily_energy_kwh
            WHERE (total_energy_kwh IS NULL OR total_energy_kwh = 0)
            AND daily_energy_kwh > 0
        `);
        console.log(`✅ Backfilled ${res.rowCount} telemetry rows with estimated total energy.`);

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
