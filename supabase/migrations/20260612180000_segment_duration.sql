-- Optional user-provided time estimate per segment (e.g. "5 mins", "1 hour")
ALTER TABLE public.route_segments
  ADD COLUMN IF NOT EXISTS estimated_duration TEXT;
