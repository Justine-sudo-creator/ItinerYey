-- ─────────────────────────────────────────────────────────────────────────────
-- Fix: Transport type filter pill timeouts on the Browse Routes page
--
-- Root cause: route_segments has no index on transport_type or route_id,
-- so every filter pill click triggers a full sequential scan of ~39K rows.
--
-- This migration:
--   1. Adds two composite indexes on route_segments
--   2. Creates a browse_routes_filtered() RPC that uses EXISTS + index for
--      fast server-side filtering (avoids the slow PostgREST !inner join)
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Index: fast lookup by transport type
CREATE INDEX IF NOT EXISTS idx_route_segments_transport_type
ON public.route_segments(transport_type);

-- 2. Composite index: covers both the join key and the filter in one B-tree
--    Supports EXISTS (SELECT 1 FROM route_segments WHERE route_id = ? AND transport_type = ANY(?))
CREATE INDEX IF NOT EXISTS idx_route_segments_route_id_transport
ON public.route_segments(route_id, transport_type);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. RPC: browse_routes_filtered
--
-- A single server-side function that handles all Browse Routes filters:
--   • transport_types  — ['Jeep'] / ['MRT','LRT'] / ['UV Express'] / NULL (all)
--   • min_confidence   — 80 for Verified filter / NULL (all)
--   • search_text      — ILIKE on origin + destination / '' (all)
--   • page_offset      — OFFSET value for pagination
--   • page_limit       — rows per page
--
-- Returns one row per route plus total_count (window function) so the
-- client gets data + pagination info in a single round-trip.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.browse_routes_filtered(
  transport_types   text[]   DEFAULT NULL,
  min_confidence    integer  DEFAULT NULL,
  search_text       text     DEFAULT '',
  page_offset       integer  DEFAULT 0,
  page_limit        integer  DEFAULT 20
)
RETURNS TABLE (
  id                uuid,
  user_id           uuid,
  origin            text,
  destination       text,
  origin_lat        double precision,
  origin_lng        double precision,
  destination_lat   double precision,
  destination_lng   double precision,
  travel_date_month integer,
  travel_date_year  integer,
  estimated_duration text,
  total_fare        numeric,
  community_notes   text,
  destination_tip   text,
  last_verified_at  timestamptz,
  confidence_score  numeric,
  created_at        timestamptz,
  total_count       bigint
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    r.id,
    r.user_id,
    r.origin,
    r.destination,
    r.origin_lat,
    r.origin_lng,
    r.destination_lat,
    r.destination_lng,
    r.travel_date_month,
    r.travel_date_year,
    r.estimated_duration,
    r.total_fare,
    r.community_notes,
    r.destination_tip,
    r.last_verified_at,
    r.confidence_score,
    r.created_at,
    COUNT(*) OVER() AS total_count
  FROM public.routes r
  WHERE
    -- Transport type filter: uses the composite index via EXISTS
    (
      transport_types IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.route_segments rs
        WHERE rs.route_id = r.id
          AND rs.transport_type = ANY(transport_types)
      )
    )
    -- Confidence score filter (for Community Verified pill)
    AND (min_confidence IS NULL OR r.confidence_score >= min_confidence)
    -- Search filter (case-insensitive on origin + destination)
    AND (
      search_text IS NULL
      OR search_text = ''
      OR r.origin      ILIKE '%' || search_text || '%'
      OR r.destination ILIKE '%' || search_text || '%'
    )
  ORDER BY r.created_at DESC
  LIMIT  page_limit
  OFFSET page_offset;
$$;
