import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';

dotenv.config();

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('🚀 Starting PowerTrack API Key Normalization (Zero Data Loss Sequence)...');

        // 1. Add api_key_hash column (NULLABLE initially)
        await client.query(`
            ALTER TABLE public.schools 
            ADD COLUMN IF NOT EXISTS api_key_hash TEXT;
        `);
        console.log('✅ 1. Step: Added api_key_hash column (nullable)');

        // 2. Migrate legacy data
        console.log('🔄 2. Step: Migrating legacy data...');
        const rows = await client.query(`
            SELECT id, name, api_key, api_key_hashed FROM public.schools 
            WHERE api_key_hash IS NULL;
        `);

        for (const row of rows.rows) {
            let hash = null;
            if (row.api_key) {
                // If plaintext exists, hash it
                hash = crypto.createHash('sha256').update(row.api_key).digest('hex');
            } else if (row.api_key_hashed) {
                // If legacy hash exists, copy it
                hash = row.api_key_hashed;
            } else {
                // Generate a new professional pt_live_ key for schools without keys
                const rawKey = `pt_live_${crypto.randomBytes(32).toString('hex')}`;
                hash = crypto.createHash('sha256').update(rawKey).digest('hex');
                console.log(`   - Generated new key for: ${row.name}`);
            }

            if (hash) {
                await client.query(`
                    UPDATE public.schools SET api_key_hash = $1 WHERE id = $2;
                `, [hash, row.id]);
            }
        }
        console.log(`✅ Migrated/Generated keys for ${rows.rowCount} schools`);

        // 3. Verify no NULL hashes remain
        const nullCount = await client.query(`
            SELECT count(*) FROM public.schools WHERE api_key_hash IS NULL;
        `);
        const count = parseInt(nullCount.rows[0].count);
        if (count > 0) {
            throw new Error(`Migration Integrity Check Failed: ${count} schools still have NULL api_key_hash`);
        }
        console.log('✅ 3. Step: Verification successful (Zero NULLs)');

        // 4. Enforce NOT NULL
        await client.query(`
            ALTER TABLE public.schools ALTER COLUMN api_key_hash SET NOT NULL;
        `);
        console.log('✅ 4. Step: Enforced NOT NULL constraint');

        // 5. Add UNIQUE index
        await client.query(`
            DROP INDEX IF EXISTS idx_schools_api_key_hash;
            CREATE UNIQUE INDEX idx_schools_api_key_hash ON public.schools(api_key_hash);
        `);
        console.log('✅ 5. Step: Created UNIQUE index');

        // 6. Handle views dependency & Drop legacy columns
        console.log('🔄 6. Step: Handling view dependencies and dropping legacy columns...');
        const schoolsResult = await client.query('SELECT id, name FROM public.schools WHERE deleted_at IS NULL');
        await client.query(`
            ALTER TABLE public.schools DROP COLUMN IF EXISTS api_key;
            ALTER TABLE public.schools DROP COLUMN IF EXISTS api_key_hashed;
        `);
        console.log('✅ Dropped legacy columns');

        // 7. Recreate active_schools view
        await client.query(`
            CREATE OR REPLACE VIEW public.active_schools AS
            SELECT * FROM public.schools WHERE deleted_at IS NULL;
        `);
        console.log('✅ 7. Step: Recreated active_schools view');

        // 8. Add version to device_profiles
        await client.query(`
            ALTER TABLE public.device_profiles 
            ADD COLUMN IF NOT EXISTS version VARCHAR(20) DEFAULT '1.0';
        `);
        console.log('✅ 8. Step: Ensured device_profiles versioning');

        console.log('🏁 PowerTrack Database Normalization Successful!');
    } catch (err: any) {
        console.error('❌ Migration Critical Failure:', err);
        if (err.detail) console.error('Detail:', err.detail);
        process.exit(1);
    } finally {
        await client.end();
    }
}

migrate();
