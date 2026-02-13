
const BASE_URL = 'http://localhost:3001/api/v1';

async function testAuth() {
    try {
        console.log('--- Testing Auth Flow ---');

        // 1. Login
        console.log('Step 1: Login (debug@powertrack.com)');
        const loginRes = await fetch(`${BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: 'debug@powertrack.com',
                password: 'password123'
            })
        });

        const loginData = await loginRes.json();
        console.log('Login Status:', loginRes.status);

        if (!loginRes.ok) {
            console.error('Login Failed:', loginData);
            process.exit(1);
        }

        const token = loginData.token;
        console.log('Token Acquired:', token ? 'Yes' : 'No');

        // 2. Verify
        console.log('\nStep 2: Verify Token');
        const verifyRes = await fetch(`${BASE_URL}/auth/verify`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        console.log('Verify Status:', verifyRes.status);
        const verifyData = await verifyRes.json(); // May fail if 500 returns HTML, but API usually returns JSON error
        console.log('Verify Response:', JSON.stringify(verifyData, null, 2));

    } catch (err) {
        console.error('Test Error:', err);
    }
}

testAuth();
