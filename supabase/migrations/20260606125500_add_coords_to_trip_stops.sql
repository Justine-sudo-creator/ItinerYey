-- Add lat/lng to trip_stops so map-pinned stops have real coordinates
ALTER TABLE trip_stops
  ADD COLUMN IF NOT EXISTS lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng DOUBLE PRECISION;
