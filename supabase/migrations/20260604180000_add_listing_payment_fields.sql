-- Add hosting listing fee columns to trip_hosting
ALTER TABLE public.trip_hosting
ADD COLUMN IF NOT EXISTS listing_reference TEXT,
ADD COLUMN IF NOT EXISTS listing_status TEXT NOT NULL DEFAULT 'free'; -- 'free' | 'pending' | 'approved' | 'rejected'

-- Add hosting credits and onboarding milestone tracker to users
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS hosting_credits INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_profile_credit_awarded BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS bio TEXT,
ADD COLUMN IF NOT EXISTS social_link TEXT;
