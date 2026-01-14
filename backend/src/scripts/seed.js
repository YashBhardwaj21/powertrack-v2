import pg from 'pg';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../../.env') });

const { Client } = pg;

const seedDatabase = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    });

    try {
        await client.connect();
        console.log('✅ Connected to database');

        // Insert sample schools
        console.log('📍 Creating sample schools...');
        const schoolsResult = await client.query(`
            INSERT INTO schools (name, type, district, latitude, longitude, total_capacity_kwp, total_cost_idr) 
            VALUES
                ('SDN Sukajadi 1', 'SD', 'Bandung Barat', -6.8915, 107.5707, 25.5, 450000000),
                ('SMPN 5 Bandung', 'SMP', 'Bandung Kota', -6.9175, 107.6191, 40.0, 720000000),
                ('SMAN 3 Cimahi', 'SMA', 'Cimahi', -6.8722, 107.5425, 50.0, 900000000),
                ('SDN Cibeunying 12', 'SD', 'Bandung Kota', -6.9147, 107.6098, 30.0, 540000000),
                ('SMPN 2 Lembang', 'SMP', 'Bandung Barat', -6.8115, 107.6175, 35.0, 630000000)
            ON CONFLICT DO NOTHING
            RETURNING id, name, api_key
        `);

        const schools = schoolsResult.rows;
        console.log(`✅ Created ${schools.length} schools`);

        // Display API keys for reference
        schools.forEach(school => {
            console.log(`   ${school.name}: ${school.api_key}`);
        });

        // Create admin user
        console.log('👤 Creating admin user...');
        const adminPassword = await bcrypt.hash('admin123', 10);
        await client.query(`
            INSERT INTO users (email, password_hash, full_name, role)
            VALUES ('admin@powertrack.com', $1, 'System Administrator', 'admin')
            ON CONFLICT (email) DO NOTHING
        `, [adminPassword]);
        console.log('✅ Admin user created (email: admin@powertrack.com, password: admin123)');

        // Create school admin users
        console.log('👥 Creating school admin users...');
        for (const school of schools) {
            const password = await bcrypt.hash('school123', 10);
            const email = `admin@${school.name.toLowerCase().replace(/\s+/g, '')}.sch.id`;

            await client.query(`
                INSERT INTO users (email, password_hash, full_name, role, school_id)
                VALUES ($1, $2, $3, 'school_admin', $4)
                ON CONFLICT (email) DO NOTHING
            `, [email, password, `${school.name} Admin`, school.id]);
        }
        console.log('✅ School admin users created (password: school123)');

        // Insert sample telemetry data
        console.log('📊 Generating sample telemetry data...');
        for (const school of schools) {
            // Generate data for the last 7 days
            const dataPoints = 7 * 24 * 12; // Every 5 minutes for 7 days
            const batchSize = 100;

            for (let i = 0; i < dataPoints; i += batchSize) {
                const values = [];
                const params = [];
                let paramCount = 1;

                for (let j = 0; j < batchSize && (i + j) < dataPoints; j++) {
                    const minutesAgo = (dataPoints - (i + j)) * 5;
                    const hour = 24 - (minutesAgo / 60) % 24;

                    // Simulate solar generation curve
                    let powerFactor = 0;
                    if (hour >= 6 && hour <= 18) {
                        const solarHour = hour - 12;
                        powerFactor = Math.max(0, 1 - Math.pow(solarHour / 6, 2));
                    }

                    const basePower = school.name.includes('SD') ? 15 : school.name.includes('SMP') ? 25 : 35;
                    const power = basePower * powerFactor * (0.8 + Math.random() * 0.4);
                    const voltage = 220 + Math.random() * 10;
                    const current = power > 0 ? (power * 1000) / voltage : 0;
                    const dailyEnergy = power * 0.0833; // 5 minutes = 1/12 hour
                    const temp = 30 + Math.random() * 20;
                    const efficiency = 15 + Math.random() * 5;
                    const weather = Math.random() > 0.7 ? 'partly_cloudy' : 'sunny';

                    values.push(`($${paramCount}, NOW() - INTERVAL '${minutesAgo} minutes', $${paramCount + 1}, $${paramCount + 2}, $${paramCount + 3}, $${paramCount + 4}, $${paramCount + 5}, $${paramCount + 6}, '${weather}')`);
                    params.push(school.id, power, voltage, current, dailyEnergy, temp, efficiency);
                    paramCount += 7;
                }

                if (values.length > 0) {
                    await client.query(`
                        INSERT INTO telemetry (school_id, timestamp, ac_power_kw, ac_voltage, ac_current, daily_energy_kwh, panel_temp_c, efficiency_percent, weather_condition)
                        VALUES ${values.join(', ')}
                    `, params);
                }
            }

            console.log(`   ✅ Generated telemetry for ${school.name}`);
        }

        console.log('✅ Sample telemetry data created');

        // Create sample alerts
        console.log('⚠️  Creating sample alerts...');
        for (const school of schools.slice(0, 2)) {
            await client.query(`
                INSERT INTO alerts (school_id, type, severity, message)
                VALUES 
                    ($1, 'underperf', 'warning', 'System performance below expected threshold'),
                    ($1, 'comm_down', 'info', 'Brief communication interruption detected')
            `, [school.id]);
        }
        console.log('✅ Sample alerts created');

        await client.end();
        console.log('\n✅ Database seeding completed successfully!');
        console.log('\n📝 Login Credentials:');
        console.log('   Admin: admin@powertrack.com / admin123');
        console.log('   School Admins: Use school email / school123');

        process.exit(0);
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        await client.end();
        process.exit(1);
    }
};

seedDatabase();
