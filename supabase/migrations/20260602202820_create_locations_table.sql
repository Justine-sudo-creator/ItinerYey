CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS public.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR UNIQUE NOT NULL,
    name VARCHAR NOT NULL,
    type VARCHAR NOT NULL,
    region_name VARCHAR,
    province_name VARCHAR,
    city_name VARCHAR,
    app_region VARCHAR
);

CREATE INDEX idx_locations_name_trgm ON public.locations USING GIN (name gin_trgm_ops);
CREATE INDEX idx_locations_type ON public.locations(type);
CREATE INDEX idx_locations_province_name ON public.locations(province_name);
CREATE INDEX idx_locations_city_name ON public.locations(city_name);
