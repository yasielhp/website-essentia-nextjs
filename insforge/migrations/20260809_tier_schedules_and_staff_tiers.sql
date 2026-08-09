-- Availability moves from a hardcoded 08:00–19:00 list to something the
-- dashboard can edit, and calendars move from services to the people who
-- actually hold them.
--
-- `schedule` is keyed by JavaScript's weekday numbers (0 = Sunday) so the
-- booking flow can look a day up without translating between conventions:
--   {"1": {"open": true, "start": "08:00", "end": "19:00"}, …}
-- The default reproduces the old TIME_SLOTS: every day, 08:00 to 19:00.
ALTER TABLE service_tiers
  ADD COLUMN IF NOT EXISTS schedule jsonb NOT NULL DEFAULT '{
    "0": {"open": true, "start": "08:00", "end": "19:00"},
    "1": {"open": true, "start": "08:00", "end": "19:00"},
    "2": {"open": true, "start": "08:00", "end": "19:00"},
    "3": {"open": true, "start": "08:00", "end": "19:00"},
    "4": {"open": true, "start": "08:00", "end": "19:00"},
    "5": {"open": true, "start": "08:00", "end": "19:00"},
    "6": {"open": true, "start": "08:00", "end": "19:00"}
  }'::jsonb;

ALTER TABLE service_tiers
  ADD COLUMN IF NOT EXISTS slot_interval_minutes integer NOT NULL DEFAULT 30;

-- Who performs which session type. Replaces `staff_services`, which tied a
-- therapist to a whole service and carried its own Google tokens; the tokens
-- belong to the person, on `profiles`, and the assignment is per treatment.
CREATE TABLE IF NOT EXISTS staff_tiers (
  staff_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id    uuid NOT NULL REFERENCES service_tiers(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  PRIMARY KEY (staff_id, tier_id)
);

CREATE INDEX IF NOT EXISTS staff_tiers_tier_idx ON staff_tiers (tier_id);

ALTER TABLE staff_tiers ENABLE ROW LEVEL SECURITY;

-- The public booking flow needs to know who can perform a treatment in order
-- to check their calendars, so reads are open; writes are the dashboard's.
--
-- Dropped first so the file can be run again: `CREATE POLICY` has no
-- `IF NOT EXISTS`, and this backend gets its migrations applied by hand.
DROP POLICY IF EXISTS "anyone_read_staff_tiers" ON staff_tiers;
CREATE POLICY "anyone_read_staff_tiers" ON staff_tiers
  FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "admin_write_staff_tiers" ON staff_tiers;
CREATE POLICY "admin_write_staff_tiers" ON staff_tiers
  FOR ALL TO authenticated
  USING (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');
