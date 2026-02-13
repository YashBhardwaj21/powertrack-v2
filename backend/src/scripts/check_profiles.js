
import pg from "pg";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const { Client } = pg;

const checkProfiles = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
    });

    try {
        await client.connect();

        const result = await client.query(`
            SELECT id, name, vendor, created_at 
            FROM public.device_profiles
            ORDER BY name, created_at;
        `);

        // Check usage
        const usageRes = await client.query(`
            SELECT device_profile_id, COUNT(*) as count 
            FROM public.schools 
            GROUP BY device_profile_id
        `);

        const usageMap = new Map();
        usageRes.rows.forEach(r => {
            if (r.device_profile_id) usageMap.set(r.device_profile_id, r.count);
        });

        const profiles = result.rows.map(r => ({
            ...r,
            school_count: usageMap.get(r.id) || 0
        }));

        console.log(JSON.stringify(profiles, null, 2));

    } catch (err) {
        console.error("❌ Error querying profiles:", err);
    } finally {
        await client.end();
    }
};

checkProfiles();
