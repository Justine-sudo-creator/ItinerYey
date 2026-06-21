-- Optional short arrival tips per stop (max ~15 words enforced in app)
ALTER TABLE public.route_segments
  ADD COLUMN IF NOT EXISTS boarding_tip TEXT,
  ADD COLUMN IF NOT EXISTS drop_off_tip TEXT;

ALTER TABLE public.routes
  ADD COLUMN IF NOT EXISTS destination_tip TEXT;
