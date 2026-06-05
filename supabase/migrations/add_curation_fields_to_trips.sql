ALTER TABLE public.trips
ADD COLUMN is_curated BOOLEAN DEFAULT false,
ADD COLUMN attribution_source TEXT,
ADD COLUMN claimed_by UUID REFERENCES public.users(id),
ADD COLUMN claim_request_by UUID REFERENCES public.users(id),
ADD COLUMN claim_proof TEXT;
