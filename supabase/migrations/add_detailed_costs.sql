ALTER TABLE trips ADD COLUMN detailed_costs JSONB DEFAULT '[]'::jsonb;
