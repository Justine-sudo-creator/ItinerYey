-- Add is_pinned to trip_hosting_messages
ALTER TABLE public.trip_hosting_messages
ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN NOT NULL DEFAULT false;

-- Add policy to allow host to update messages (to pin/unpin)
CREATE POLICY "Allow host to update messages" ON public.trip_hosting_messages FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM public.trip_hosting WHERE id = hosting_id AND host_user_id = auth.uid())
);

-- Enable Realtime for trip_hosting_messages
-- Drop from publication if already exists to prevent errors, then add it.
-- Actually, we can just do an ALTER PUBLICATION but Supabase requires it this way safely:
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'trip_hosting_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_hosting_messages;
    END IF;
  END
  $$;
COMMIT;
