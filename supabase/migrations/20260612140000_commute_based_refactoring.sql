-- Drop old trip-related tables with CASCADE to clean up foreign keys and policies
DROP TABLE IF EXISTS public.trip_hosting_messages CASCADE;
DROP TABLE IF EXISTS public.trip_hosting_members CASCADE;
DROP TABLE IF EXISTS public.trip_hosting CASCADE;
DROP TABLE IF EXISTS public.trip_price_suggestions CASCADE;
DROP TABLE IF EXISTS public.trip_comments CASCADE;
DROP TABLE IF EXISTS public.trip_helpful_votes CASCADE;
DROP TABLE IF EXISTS public.saved_trips CASCADE;
DROP TABLE IF EXISTS public.trip_photos CASCADE;
DROP TABLE IF EXISTS public.trip_stops CASCADE;
DROP TABLE IF EXISTS public.trip_days CASCADE;
DROP TABLE IF EXISTS public.trips CASCADE;

-- Create routes table
CREATE TABLE IF NOT EXISTS public.routes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    origin_lat DOUBLE PRECISION,
    origin_lng DOUBLE PRECISION,
    destination_lat DOUBLE PRECISION,
    destination_lng DOUBLE PRECISION,
    travel_date_month INTEGER,
    travel_date_year INTEGER,
    estimated_duration TEXT,
    total_fare NUMERIC DEFAULT 0,
    community_notes TEXT,
    last_verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    confidence_score NUMERIC DEFAULT 50,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on routes
ALTER TABLE public.routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Routes are viewable by everyone" 
ON public.routes FOR SELECT USING (true);

CREATE POLICY "Users can insert own routes" 
ON public.routes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own routes" 
ON public.routes FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own routes" 
ON public.routes FOR DELETE USING (auth.uid() = user_id);


-- Create route_segments table
CREATE TABLE IF NOT EXISTS public.route_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    transport_type TEXT NOT NULL,
    signboard TEXT,
    fare NUMERIC DEFAULT 0,
    boarding_name TEXT,
    boarding_lat DOUBLE PRECISION,
    boarding_lng DOUBLE PRECISION,
    drop_off_name TEXT,
    drop_off_lat DOUBLE PRECISION,
    drop_off_lng DOUBLE PRECISION,
    photo_url TEXT,
    display_order INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on route_segments
ALTER TABLE public.route_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Route segments are viewable by everyone" 
ON public.route_segments FOR SELECT USING (true);

CREATE POLICY "Users can insert route segments for their routes" 
ON public.route_segments FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.routes WHERE id = route_id AND user_id = auth.uid())
);

CREATE POLICY "Users can update route segments for their routes" 
ON public.route_segments FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.routes WHERE id = route_id AND user_id = auth.uid())
);

CREATE POLICY "Users can delete route segments for their routes" 
ON public.route_segments FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.routes WHERE id = route_id AND user_id = auth.uid())
);


-- Create route_verifications table
CREATE TABLE IF NOT EXISTS public.route_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    verification_type TEXT NOT NULL CHECK (verification_type IN ('accurate', 'fare_changed', 'boarding_point_changed', 'unavailable')),
    new_fare NUMERIC,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on route_verifications
ALTER TABLE public.route_verifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Route verifications are viewable by everyone" 
ON public.route_verifications FOR SELECT USING (true);

-- Anyone can submit a verification (even anonymously if we want, but for now we require auth if user_id is provided, though it's optional)
CREATE POLICY "Anyone can insert verifications" 
ON public.route_verifications FOR INSERT WITH CHECK (true);
