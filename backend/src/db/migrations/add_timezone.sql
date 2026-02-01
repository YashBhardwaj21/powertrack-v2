-- Add timezone column to schools table
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- Optional: Update existing schools to a default timezone (e.g. Asia/Jakarta for Indonesia context as implied by IDR currency)
UPDATE public.schools SET timezone = 'Asia/Jakarta' WHERE timezone = 'UTC';
