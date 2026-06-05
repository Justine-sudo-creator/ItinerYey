ALTER TABLE public.trips
ADD COLUMN is_public BOOLEAN DEFAULT true;

-- Update existing rows to be public
UPDATE public.trips SET is_public = true WHERE is_public IS NULL;

-- Make the column NOT NULL if desired, though we'll leave it as nullable/default true for flexibility,
-- or just keep it as simple boolean.
-- ALTER TABLE public.trips ALTER COLUMN is_public SET NOT NULL;
