-- Enable Realtime for trip_hosting and trip_hosting_members tables
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'trip_hosting'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_hosting;
    END IF;
  END
  $$;
COMMIT;

BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 
      FROM pg_publication_tables 
      WHERE pubname = 'supabase_realtime' 
      AND schemaname = 'public' 
      AND tablename = 'trip_hosting_members'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.trip_hosting_members;
    END IF;
  END
  $$;
COMMIT;
