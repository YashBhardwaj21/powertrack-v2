import { query, pool } from '../db/index.js';

async function fixFinancialData() {
    try {
        console.log('\n💰 FIXING FINANCIAL DATA...\n');

        // 1. Ensure System Parameters (Tariff & Carbon)
        const tariff = 1444.70; // PLN Standard
        const carbon = 0.85;    // kg CO2/kWh

        await query(`
      INSERT INTO public.system_parameters (key, value, unit, label)
      VALUES 
        ('electricity_rate_idr', $1, 'IDR/kWh', 'Commercial Electricity Tariff'),
        ('carbon_intensity_kg_per_kwh', $2, 'kg CO2/kWh', 'Grid Carbon Intensity')
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `, [tariff, carbon]);
        console.log(`✅ System Parameters: Tariff=${tariff}, Carbon=${carbon}`);

        // 2. Update Schools CAPEX based on Capacity
        // Rule of thumb: ~15,000,000 IDR per kWp for commercial installation
        const schools = await query('SELECT id, name, total_capacity_kwp FROM public.schools');

        for (const school of schools.rows) {
            const capacity = parseFloat(school.total_capacity_kwp) || 5.0; // Default 5kWp if missing

            // Calculate realistic cost: 14M - 18M per kWp random variation
            const costPerKw = 14000000 + Math.random() * 4000000;
            const totalCost = Math.round(capacity * costPerKw);

            await query(
                'UPDATE public.schools SET total_cost_idr = $1 WHERE id = $2',
                [totalCost, school.id]
            );

            console.log(`✅ Updated ${school.name}: ${capacity}kWp -> ${totalCost.toLocaleString()} IDR`);
        }

        console.log('\n✨ Financial data backfilled successfully.');
        await pool.end();
    } catch (err) {
        console.error('❌ Failed:', err);
    }
}

fixFinancialData();
