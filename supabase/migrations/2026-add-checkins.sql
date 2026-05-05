CREATE TABLE IF NOT EXISTS daily_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text REFERENCES users(id) ON DELETE CASCADE,
  sleep int CHECK (sleep BETWEEN 0 AND 10),
  mood int CHECK (mood BETWEEN 0 AND 10),
  energy int CHECK (energy BETWEEN 0 AND 10),
  stress int CHECK (stress BETWEEN 0 AND 10),
  hydration int CHECK (hydration BETWEEN 0 AND 10),
  notes text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE daily_checkins DISABLE ROW LEVEL SECURITY;
