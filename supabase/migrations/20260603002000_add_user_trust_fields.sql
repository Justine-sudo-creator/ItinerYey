-- Add trust metrics to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS is_wallet_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS wallet_phone_masked TEXT,
ADD COLUMN IF NOT EXISTS vouch_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_verified_organizer BOOLEAN DEFAULT false;

-- Create verification requests tracking table
CREATE TABLE IF NOT EXISTS public.profile_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  facebook_link TEXT NOT NULL,
  gcash_reference TEXT UNIQUE NOT NULL, -- Unique constraint prevents duplicate claim scams
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'approved' | 'rejected'
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.profile_verifications ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read own verifications" 
ON public.profile_verifications FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Allow authenticated submit verification" 
ON public.profile_verifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
