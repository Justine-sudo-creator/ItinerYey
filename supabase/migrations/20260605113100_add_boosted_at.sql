-- Add boosted_at column to trip_hosting to track when a meetup boost was approved
ALTER TABLE trip_hosting ADD COLUMN boosted_at timestamp with time zone;
