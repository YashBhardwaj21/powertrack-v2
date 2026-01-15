
import { query, pool } from '../db/index.js';

const verifySignup = async () => {
    try {
        console.log('🧪 Starting Signup Verification...');

        const testEmail = `test.user.${Date.now()}@example.com`;
        const testPassword = 'password123';

        console.log(`📝 Attempting to register user: ${testEmail}`);

        const response = await fetch('http://localhost:3001/api/v1/auth/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: testEmail,
                password: testPassword,
                full_name: 'Test User',
                role: 'viewer'
            })
        });

        const data = await response.json();

        if (response.status === 201) {
            console.log('✅ Signup Successful!', {
                id: data.user.id,
                email: data.user.email
            });

            // Cleanup
            console.log('🧹 Cleaning up test user...');
            await query('DELETE FROM public.users WHERE email = $1', [testEmail]);
            console.log('✅ Cleanup complete.');

        } else {
            console.error(`❌ Signup Failed! Status: ${response.status}`, data);
            process.exit(1);
        }

    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
};

verifySignup();
