ALTER TABLE public.trips ADD COLUMN cost_scope VARCHAR DEFAULT 'individual';

-- Update existing trips to default to individual scope
UPDATE public.trips SET cost_scope = 'individual' WHERE cost_scope IS NULL;
