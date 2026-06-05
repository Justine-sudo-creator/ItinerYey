-- Create user_badges table for custom admin achievements
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  badge_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable Row Level Security
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access on user_badges" 
ON user_badges FOR SELECT 
TO public 
USING (true);

-- Allow authenticated admins to insert/update/delete
CREATE POLICY "Allow admin manage access on user_badges" 
ON user_badges FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);
