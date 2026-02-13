
import { query } from './dist/db/index.js';
import bcrypt from 'bcrypt';

(async () => {
    try {
        console.log('Fetching school...');
        const schoolRes = await query('SELECT id FROM schools LIMIT 1');
        if (schoolRes.rows.length === 0) {
            console.error('No schools found!');
            process.exit(1);
        }
        const schoolId = schoolRes.rows[0].id;
        console.log('School ID:', schoolId);

        const email = 'debug@powertrack.com';
        const password = 'password123';
        const hashedPassword = await bcrypt.hash(password, 10);

        console.log('Creating/Updating user...');
        const res = await query(`
            INSERT INTO users (email, password_hash, full_name, role, school_id)
            VALUES ($1, $2, 'Debug User', 'school_admin', $3)
            ON CONFLICT (email) 
            DO UPDATE SET 
                password_hash = $2,
                school_id = $3,
                role = 'school_admin'
            RETURNING id, email
        `, [email, hashedPassword, schoolId]);

        console.log('User created:', res.rows[0]);
        process.exit(0);
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
})();
