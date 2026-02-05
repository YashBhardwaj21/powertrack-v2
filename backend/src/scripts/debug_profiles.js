
import { query } from '../db/index.js';

async function main() {
    try {
        const res = await query('SELECT * FROM public.device_profiles');
        console.log(JSON.stringify(res.rows, null, 2));
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
