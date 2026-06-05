CREATE TABLE IF NOT EXISTS public.location_search_cache (
    query VARCHAR PRIMARY KEY,
    results JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.location_search_cache ENABLE ROW LEVEL SECURITY;

-- Enable SELECT for everyone
CREATE POLICY "Enable read access for all users" ON public.location_search_cache
    FOR SELECT USING (true);

-- Enable write access for service role only
CREATE POLICY "Enable write access for service role only" ON public.location_search_cache
    FOR ALL TO service_role USING (true) WITH CHECK (true);
