-- Add preferred_language to contacts and profiles tables
ALTER TABLE contacts
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en'
    CHECK (preferred_language IN ('en', 'es'));

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en'
    CHECK (preferred_language IN ('en', 'es'));
