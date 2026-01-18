-- =========================================================
-- API Key Normalization Migration
-- =========================================================
-- Purpose: Enforce single source of truth for API key storage
-- Strategy: api_key_hash (SHA-256) as the ONLY column
-- Safety: Aborts on duplicates, logs all changes
-- =========================================================

BEGIN;

-- Step 1: Add api_key_hash column if it doesn't exist (nullable initially)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'schools' 
        AND column_name = 'api_key_hash'
    ) THEN
        ALTER TABLE public.schools ADD COLUMN api_key_hash TEXT;
        RAISE NOTICE 'Added api_key_hash column';
    ELSE
        RAISE NOTICE 'api_key_hash column already exists';
    END IF;
END $$;

-- Step 2: Migrate legacy api_key column if it exists
DO $$
DECLARE
    legacy_count INTEGER;
BEGIN
    -- Check if legacy api_key column exists
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'schools' 
        AND column_name = 'api_key'
    ) THEN
        -- Count schools with legacy keys but no hash
        SELECT COUNT(*) INTO legacy_count
        FROM public.schools
        WHERE api_key IS NOT NULL AND api_key_hash IS NULL;
        
        RAISE NOTICE 'Found % schools with legacy api_key to migrate', legacy_count;
        
        -- Migrate: Hash the plaintext key (this assumes legacy keys were stored as plaintext)
        -- WARNING: This is a one-way migration
        UPDATE public.schools
        SET api_key_hash = encode(digest(api_key, 'sha256'), 'hex')
        WHERE api_key IS NOT NULL AND api_key_hash IS NULL;
        
        RAISE NOTICE 'Migrated % legacy API keys', legacy_count;
    END IF;
END $$;

-- Step 3: Migrate legacy api_key_hashed column if it exists
DO $$
DECLARE
    legacy_hashed_count INTEGER;
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'schools' 
        AND column_name = 'api_key_hashed'
    ) THEN
        SELECT COUNT(*) INTO legacy_hashed_count
        FROM public.schools
        WHERE api_key_hashed IS NOT NULL AND api_key_hash IS NULL;
        
        RAISE NOTICE 'Found % schools with legacy api_key_hashed to migrate', legacy_hashed_count;
        
        -- Copy hashed values directly
        UPDATE public.schools
        SET api_key_hash = api_key_hashed
        WHERE api_key_hashed IS NOT NULL AND api_key_hash IS NULL;
        
        RAISE NOTICE 'Migrated % legacy hashed API keys', legacy_hashed_count;
    END IF;
END $$;

-- Step 4: Check for duplicate hashes (data integrity issue)
DO $$
DECLARE
    duplicate_count INTEGER;
    duplicate_hashes TEXT;
BEGIN
    SELECT COUNT(*), string_agg(api_key_hash, ', ')
    INTO duplicate_count, duplicate_hashes
    FROM (
        SELECT api_key_hash, COUNT(*) as cnt
        FROM public.schools
        WHERE api_key_hash IS NOT NULL
        GROUP BY api_key_hash
        HAVING COUNT(*) > 1
    ) duplicates;
    
    IF duplicate_count > 0 THEN
        RAISE EXCEPTION 'ABORT: Found % duplicate API key hashes: %', duplicate_count, duplicate_hashes;
    ELSE
        RAISE NOTICE 'No duplicate API key hashes found - safe to proceed';
    END IF;
END $$;

-- Step 5: Enforce NOT NULL constraint
-- Note: This will fail if any schools have NULL api_key_hash
-- Those schools need to be handled manually or assigned new keys
ALTER TABLE public.schools 
    ALTER COLUMN api_key_hash SET NOT NULL;

RAISE NOTICE 'Enforced NOT NULL constraint on api_key_hash';

-- Step 6: Add UNIQUE constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'schools_api_key_hash_unique'
    ) THEN
        ALTER TABLE public.schools 
            ADD CONSTRAINT schools_api_key_hash_unique UNIQUE (api_key_hash);
        RAISE NOTICE 'Added UNIQUE constraint on api_key_hash';
    ELSE
        RAISE NOTICE 'UNIQUE constraint already exists';
    END IF;
END $$;

-- Step 7: Drop legacy columns (DESTRUCTIVE - only after verification)
DO $$
BEGIN
    -- Drop api_key column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'schools' 
        AND column_name = 'api_key'
    ) THEN
        ALTER TABLE public.schools DROP COLUMN api_key;
        RAISE NOTICE 'Dropped legacy api_key column';
    END IF;
    
    -- Drop api_key_hashed column
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'schools' 
        AND column_name = 'api_key_hashed'
    ) THEN
        ALTER TABLE public.schools DROP COLUMN api_key_hashed;
        RAISE NOTICE 'Dropped legacy api_key_hashed column';
    END IF;
END $$;

-- Step 8: Verify final state
DO $$
DECLARE
    total_schools INTEGER;
    schools_with_hash INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_schools FROM public.schools;
    SELECT COUNT(*) INTO schools_with_hash FROM public.schools WHERE api_key_hash IS NOT NULL;
    
    RAISE NOTICE '=== MIGRATION COMPLETE ===';
    RAISE NOTICE 'Total schools: %', total_schools;
    RAISE NOTICE 'Schools with api_key_hash: %', schools_with_hash;
    
    IF total_schools != schools_with_hash THEN
        RAISE WARNING 'Some schools are missing API key hashes!';
    END IF;
END $$;

COMMIT;
