-- Add country and postal_code fields for better geocoding
-- This will allow accurate location resolution without manual lat/lng entry

ALTER TABLE public.schools 
ADD COLUMN IF NOT EXISTS country VARCHAR(100) DEFAULT 'Indonesia',
ADD COLUMN IF NOT EXISTS postal_code VARCHAR(20);

-- Update existing records to have Indonesia as default country
UPDATE public.schools 
SET country = 'Indonesia' 
WHERE country IS NULL;
