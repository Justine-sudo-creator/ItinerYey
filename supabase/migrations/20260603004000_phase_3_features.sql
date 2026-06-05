-- Add gcash_account_name to profile_verifications
ALTER TABLE public.profile_verifications
ADD COLUMN IF NOT EXISTS gcash_account_name TEXT;

-- Create trip_hosting_members table for Meetup Roster
CREATE TABLE IF NOT EXISTS public.trip_hosting_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hosting_id UUID NOT NULL REFERENCES public.trip_hosting(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(hosting_id, user_id)
);

-- Enable RLS for members
ALTER TABLE public.trip_hosting_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read members" ON public.trip_hosting_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert members" ON public.trip_hosting_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow host to update members" ON public.trip_hosting_members FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.trip_hosting WHERE id = hosting_id AND host_user_id = auth.uid())
);
CREATE POLICY "Allow user to update own status" ON public.trip_hosting_members FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Create trip_hosting_messages table for Meetup Bulletin Board
CREATE TABLE IF NOT EXISTS public.trip_hosting_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hosting_id UUID NOT NULL REFERENCES public.trip_hosting(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for messages
ALTER TABLE public.trip_hosting_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read messages" ON public.trip_hosting_messages FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert messages" ON public.trip_hosting_messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- Create trip_price_suggestions table for Crowdsourced Price Audits
CREATE TABLE IF NOT EXISTS public.trip_price_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  suggested_by_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  category TEXT NOT NULL, -- 'Transport', 'Food', 'Activities', 'Accommodation'
  suggested_amount DECIMAL NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for price suggestions
ALTER TABLE public.trip_price_suggestions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read suggestions" ON public.trip_price_suggestions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Allow authenticated insert suggestions" ON public.trip_price_suggestions FOR INSERT TO authenticated WITH CHECK (auth.uid() = suggested_by_user_id);
CREATE POLICY "Allow trip owner update suggestions" ON public.trip_price_suggestions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.trips WHERE id = trip_id AND user_id = auth.uid())
);
-- Add increment_vouch_count RPC
CREATE OR REPLACE FUNCTION increment_vouch_count(target_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $function
BEGIN
  UPDATE public.users SET vouch_count = COALESCE(vouch_count, 0) + 1, total_vouches = COALESCE(total_vouches, 0) + 1 WHERE id = target_user_id;
END;
$function;
