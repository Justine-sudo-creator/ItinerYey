-- Add cancellation_reason column to trip_hosting table
ALTER TABLE public.trip_hosting ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
