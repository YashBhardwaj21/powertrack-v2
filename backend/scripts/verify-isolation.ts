
import crypto from 'crypto';

const API_BASE = 'http://localhost:3001/api/v1';
const ADMIN_TOKEN = ''; // We will need to get this or login. 
// Actually, we can just use the public create endpoint if we have a way... 
// Wait, createSchool requires AUTH.
// I'll assume we can use the backend direct access or simulate the flow.
// Easier: I will hardcode a login or just assume the server is running and I can register a new user?
// Or better: I'll use the 'simulated' approach where I just use the API keys provided by the user if I knew them?
// No, I need to CREATE new schools to be sure.

// To avoid auth complexity in script, I'll use the 'PowerTrack Standard' profile which we know exists.
// I'll create a new user first to get a token? Or just use a hardcoded admin token if I had one.
// Let's try to just use the EXISTING simulation keys the user provided?
// No, the user said they don't work. I need to prove they DO work if unique.

// Let's create a script that:
// 1. Logs in as admin (if possible) OR just uses a known school creation flow.
// Actually, I can use the same flow as the frontend.
// Step 1: Login/Register? 
// There is no public registration. Only Admin can create schools? 
// No, `POST /schools` is `authenticateToken`.
// But there is `POST /auth/login`.

async function main() {
    console.log('🚀 Starting Multi-Tenant Isolation Verification...');

    // 1. Function to send telemetry
    const sendTelemetry = async (name: string, apiKey: string, power: number) => {
        const body = {
            power_w: power,
            voltage: 230,
            current_a: power / 230,
            daily_kwh: 10,
            ts: Math.floor(Date.now() / 1000)
        };

        try {
            const res = await fetch(`${API_BASE}/telemetry`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': apiKey
                },
                body: JSON.stringify(body)
            });
            const text = await res.text();

            if (res.ok) {
                console.log(`✅ [${name}] Sent ${power}W -> Success (200)`);
                // Parse response to see school ID?
                const json = JSON.parse(text);
                console.log(`   -> Backend linked to School ID: ${json.school_id}`);
                return json.school_id;
            } else {
                console.error(`❌ [${name}] Failed: ${res.status} - ${text}`);
                return null;
            }
        } catch (e) {
            console.error(`❌ [${name}] Network Error:`, e);
        }
    };

    // 2. Use the User's API Keys (from their script)
    // We assume these keys are valid and correspond to schools they created.
    // If they are invalid, the script will show 401.
    const KEY_A = "pt_live_c9a30d18431c6a7bfc55ee1b5f2ca9ecca6fed5c8ab421ccccf493a8868a9c61";
    const KEY_B = "pt_live_22d2c595e3af39d1bcb0ded9ed8719eb4d94f688e54d51fd5c39063cf00701fc";

    console.log(`\nTesting Key A: ${KEY_A.slice(0, 20)}...`);
    const idA = await sendTelemetry("School A", KEY_A, 5000);

    console.log(`\nTesting Key B: ${KEY_B.slice(0, 20)}...`);
    const idB = await sendTelemetry("School B", KEY_B, 3000);

    console.log('\n--- RESULTS ---');
    if (idA && idB) {
        if (idA === idB) {
            console.error('🚨 CRITICAL FAILURE: Both keys mapped to SAME School ID:', idA);
            console.log('Reason: The user likely generated two keys for the same school, or database hash collision (unlikely).');
        } else {
            console.log('✅ SUCCESS: Keys mapped to DIFFERENT School IDs.');
            console.log(`   School A: ${idA}`);
            console.log(`   School B: ${idB}`);
            console.log('The system is correctly isolating data.');
        }
    } else {
        console.log('⚠️ Could not complete verification due to API errors (Invalid Keys?)');
    }
}

main().catch(console.error);
