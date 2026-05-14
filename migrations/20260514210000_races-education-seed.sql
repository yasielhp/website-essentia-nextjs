-- Add time display column to races (e.g. "7:30 am")
ALTER TABLE races ADD COLUMN IF NOT EXISTS time TEXT;

-- Add speaker info and pricing to education_sessions
-- price_cents: NULL = included in membership, 0 = free for all, >0 = paid
ALTER TABLE education_sessions ADD COLUMN IF NOT EXISTS speaker TEXT;
ALTER TABLE education_sessions ADD COLUMN IF NOT EXISTS speaker_role TEXT;
ALTER TABLE education_sessions ADD COLUMN IF NOT EXISTS price_cents INT;

-- ─── Seed: Running Club next run ─────────────────────────────
INSERT INTO races (title, description, date, time, location, distance_km)
VALUES (
  'Fanabe Coastal Path',
  'The Fanabe coastal path. 10 km along the seafront promenade with Atlantic views from start to finish. Ends with breakfast at the club.',
  '2026-05-24',
  '7:30 am',
  'Baobab Suites lobby, Costa Adeje',
  10
);

-- ─── Seed: Education session ─────────────────────────────────
-- 2026-06-05 19:00 WEST (UTC+1) = 18:00 UTC
INSERT INTO education_sessions (
  title, description, date, duration_minutes,
  location, max_participants, speaker, speaker_role, price_cents
) VALUES (
  'The Science of Sleep',
  'Why sleep is the single highest-leverage intervention for longevity, and what the latest research says about optimising it for your biology. The first hour is a structured talk with slides; the second is open Q&A.',
  '2026-06-05 18:00:00+00',
  120,
  'Essentia Longevity Center, Costa Adeje',
  20,
  'Dr. Elena Voss',
  'Neuroscience & Recovery',
  NULL
);
