-- Create active_challenge table for admin customization
CREATE TABLE IF NOT EXISTS active_challenge (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  hashtag TEXT NOT NULL,
  reward_badge TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security (RLS)
ALTER TABLE active_challenge ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on active_challenge" 
ON active_challenge FOR SELECT 
TO public 
USING (true);

-- Allow authenticated admins to insert/update/delete
CREATE POLICY "Allow admin manage access on active_challenge" 
ON active_challenge FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
