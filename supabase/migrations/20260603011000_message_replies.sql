-- Add reply_to_id to trip_hosting_messages
ALTER TABLE public.trip_hosting_messages
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.trip_hosting_messages(id) ON DELETE SET NULL;

-- Add reply_to_id to trip_comments
ALTER TABLE public.trip_comments
ADD COLUMN IF NOT EXISTS reply_to_id UUID REFERENCES public.trip_comments(id) ON DELETE SET NULL;
