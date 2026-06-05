CREATE TABLE IF NOT EXISTS public.trip_hosting (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  host_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_date DATE NOT NULL,
  slots_needed INT NOT NULL DEFAULT 1,
  contact_link TEXT NOT NULL,
  host_note TEXT,
  status TEXT NOT NULL DEFAULT 'open', -- 'open' | 'full' | 'archived' | 'expired'
  
  -- Monetization & Boost verification
  hosting_tier TEXT NOT NULL DEFAULT 'standard', -- 'standard' (free buddy search) | 'pro' (commercial organizer)
  is_boosted BOOLEAN NOT NULL DEFAULT false, -- Paid highlight placement
  boost_reference TEXT UNIQUE, -- 12-digit GCash Ref Number
  boost_status TEXT NOT NULL DEFAULT 'none', -- 'none' | 'pending' | 'approved' | 'rejected'
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.trip_hosting ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read active hosting" 
ON public.trip_hosting FOR SELECT TO public USING (true);

CREATE POLICY "Allow authenticated manage own hosting" 
ON public.trip_hosting FOR ALL TO authenticated USING (auth.uid() = host_user_id) WITH CHECK (auth.uid() = host_user_id);
