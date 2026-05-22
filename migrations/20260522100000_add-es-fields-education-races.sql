-- Add Spanish title/description fields to education_sessions and running_races
ALTER TABLE education_sessions
  ADD COLUMN IF NOT EXISTS title_es TEXT,
  ADD COLUMN IF NOT EXISTS description_es TEXT;

ALTER TABLE races
  ADD COLUMN IF NOT EXISTS title_es TEXT,
  ADD COLUMN IF NOT EXISTS description_es TEXT;
