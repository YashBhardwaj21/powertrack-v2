-- Remove latitude and longitude columns from schools table
-- This migration removes manual coordinate entry in favor of automatic geocoding

ALTER TABLE public.schools 
DROP COLUMN IF EXISTS latitude,
DROP COLUMN IF EXISTS longitude;
