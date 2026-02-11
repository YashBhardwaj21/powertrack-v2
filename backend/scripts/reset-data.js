import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

async function resetData() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL
    });

    try {
        await client.connect();
        console.log('🔗 Connected to database...');

        // Clear telemetry
        console.log('🗑️  Deleting telemetry data...');
        const telemetryResult = await client.query('DELETE FROM telemetry');
        console.log(`✅ ${telemetryResult.rowCount} telemetry records deleted`);

        // Clear daily aggregates
        try {
            console.log('🗑️  Deleting daily aggregates...');
            const dailyResult = await client.query('DELETE FROM telemetry_daily');
            console.log(`✅ ${dailyResult.rowCount} daily aggregate records deleted`);
        } catch (err) {
            console.log('⚠️  No telemetry_daily table (skipping)');
        }

        // Clear alerts
        try {
            console.log('🗑️  Deleting alerts...');
            const alertsResult = await client.query('DELETE FROM alerts');
            console.log(`✅ ${alertsResult.rowCount} alerts deleted`);
        } catch (err) {
            console.log('⚠️  No alerts table (skipping)');
        }

        // Verify
        const verifyResult = await client.query(`
            SELECT 
                (SELECT COUNT(*) FROM telemetry) as telemetry_count,
                (SELECT COUNT(*) FROM schools) as schools_count
        `);

        console.log('\n📊 Final counts:');
        console.log(`   Telemetry: ${verifyResult.rows[0].telemetry_count}`);
        console.log(`   Schools: ${verifyResult.rows[0].schools_count}`);
        console.log('\n✨ Data reset complete!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

resetData();
