
import pg from 'pg';
const { Client } = pg;

const connectionString = 'postgresql://postgres.cqdrjhugitgxbeybboee:Ybsaturnkt1607@aws-1-ap-south-1.pooler.supabase.com:6543/postgres';

async function main() {
    const client = new Client({ connectionString });
    try {
        await client.connect();
        const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'telemetry'");
        console.log('Telemetry Columns:', res.rows.map(r => r.column_name).join(', '));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    } finally {
        await client.end();
    }
}
main();
