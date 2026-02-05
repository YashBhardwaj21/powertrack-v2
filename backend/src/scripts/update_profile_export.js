
import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.cqdrjhugitgxbeybboee:Ybsaturnkt1607@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();

        // Update field map to include energy_export_today
        // Note: We use || to merge, or just rewrite the whole JSON to be safe
        await client.query(`
            UPDATE public.device_profiles 
            SET field_map = field_map || '{"energy_export_today": "energy_export_today", "energy_import_today": "energy_import_today"}'::jsonb
            WHERE name = 'PowerTrack Standard'
        `);
        console.log('✅ Updated PowerTrack Standard profile field_map with export/import fields');

        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err);
        process.exit(1);
    } finally {
        await client.end();
    }
}

main();
