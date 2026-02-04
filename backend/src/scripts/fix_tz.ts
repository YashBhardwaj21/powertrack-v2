
import { query } from '../db/index.js';

// Enhanced Global Logic
const getTimezoneForDistrict = (district) => {
    if (!district) return 'Asia/Kolkata';

    const d = district.toLowerCase();

    // INDIA (UTC+5:30)
    const indiaKeywords = [
        'kurnool', 'hyderabad', 'bangalore', 'mumbai', 'delhi', 'chennai', 'kolkata', 'pune',
        'andhra', 'telangana', 'karnataka', 'maharashtra', 'india', 'noida', 'gurgaon', 'jaipur'
    ];

    // AUSTRALIA (UTC+10 etc)
    // User specifically mentioned "Queensland" and "Queenstown" in context of Australia
    const auBrisbane = ['queensland', 'brisbane', 'gold coast', 'cairns', 'townsville', 'mackay', 'rockhampton', 'queenstown'];
    const auSydney = ['sydney', 'nsw', 'new south wales', 'canberra', 'melbourne', 'victoria'];
    const auPerth = ['perth', 'western australia'];

    // WITA (UTC+8)
    const witaKeywords = [
        'bali', 'denpasar', 'badung', 'gianyar', 'tabanan',
        'makassar', 'manado', 'palu', 'kendari', 'gorontalo', 'mamuju',
        'lombok', 'mataram', 'sumbawa', 'kupang', 'flores',
        'balikpapan', 'samarinda', 'bontang', 'tarakan', 'banjarmasin'
    ];

    // WIT (UTC+9)
    const witKeywords = [
        'ambon', 'tual', 'ternate', 'tidore',
        'jayapura', 'merauke', 'sorong', 'manokwari', 'mimika', 'biak'
    ];

    if (indiaKeywords.some(k => d.includes(k))) return 'Asia/Kolkata';
    if (auBrisbane.some(k => d.includes(k))) return 'Australia/Brisbane';
    if (auSydney.some(k => d.includes(k))) return 'Australia/Sydney';
    if (auPerth.some(k => d.includes(k))) return 'Australia/Perth';
    if (witaKeywords.some(k => d.includes(k))) return 'Asia/Makassar';
    if (witKeywords.some(k => d.includes(k))) return 'Asia/Jayapura';

    return 'Asia/Jakarta';
};

const fixTimezones = async () => {
    try {
        console.log("--- Updating School Timezones (Global) ---");
        const schools = await query(`SELECT id, name, district, timezone FROM public.schools`);

        for (const s of schools.rows) {
            const correctTz = getTimezoneForDistrict(s.district);

            if (s.timezone !== correctTz) {
                console.log(`Updating ${s.name} (${s.district}): ${s.timezone} -> ${correctTz}`);
                await query(`UPDATE public.schools SET timezone = $1 WHERE id = $2`, [correctTz, s.id]);
            } else {
                console.log(`✅ ${s.name} (${s.district}) is already ${s.timezone}`);
            }
        }
    } catch (error) {
        console.error(error);
    }
};

fixTimezones();
