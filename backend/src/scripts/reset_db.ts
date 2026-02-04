import { query, pool } from '../db/index.js';
import { logger } from '../utils/logger.js';

async function resetDatabase() {
    try {
        console.log('\n\n🚨 FACTORY RESET INITIATED 🚨');
        console.log('This will PERMANENTLY DELETE all:');
        console.log('- Users');
        console.log('- Schools');
        console.log('- Telemetry Data');
        console.log('- Alerts');
        console.log('\nWaiting 5 seconds before destruction... (Press Ctrl+C to cancel)\n');

        await new Promise(resolve => setTimeout(resolve, 5000));

        logger.info('Resetting database...');

        // Disable triggers to speed up and avoid foreign key complexity (though CASCADE handles it)
        // Actually CASCADE is safer.

        // Truncate tables
        await query(`
      TRUNCATE TABLE 
        public.alerts, 
        public.telemetry, 
        public.schools, 
        public.users
      RESTART IDENTITY CASCADE;
    `);

        logger.info('✅ Database reset complete. System is clean.');
        console.log('\n✨ Fresh start ready. You can now register a new admin user on the login page.\n');

        await pool.end();
        process.exit(0);
    } catch (err) {
        logger.error('❌ Reset failed:', err);
        process.exit(1);
    }
}

resetDatabase();
