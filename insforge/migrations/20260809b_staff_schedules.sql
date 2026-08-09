-- The weekly schedule belongs to the person, not to the treatment.
--
-- Yesterday's migration hung it on `service_tiers`, which read as "when can
-- this treatment be booked". That is not the real constraint: a treatment has
-- no working days, the therapist who performs it does. Availability is now
-- the assigned staff's own days and hours, intersected with their calendar.
--
-- Keyed by JavaScript's weekday numbers (0 = Sunday) so the booking flow can
-- look a day up without translating between conventions. The default
-- reproduces the old TIME_SLOTS: every day, 08:00 to 19:00.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS schedule jsonb NOT NULL DEFAULT '{
    "0": {"open": false, "start": "08:00", "end": "19:00"},
    "1": {"open": true,  "start": "08:00", "end": "19:00"},
    "2": {"open": true,  "start": "08:00", "end": "19:00"},
    "3": {"open": true,  "start": "08:00", "end": "19:00"},
    "4": {"open": true,  "start": "08:00", "end": "19:00"},
    "5": {"open": true,  "start": "08:00", "end": "19:00"},
    "6": {"open": false, "start": "08:00", "end": "19:00"}
  }'::jsonb;

-- How finely the day is chopped into bookable starts for this person.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS slot_interval_minutes integer NOT NULL DEFAULT 30;

-- Both columns only ever held their defaults on service_tiers: they were
-- added on 2026-08-09 and never edited before the model changed.
ALTER TABLE service_tiers DROP COLUMN IF EXISTS schedule;
ALTER TABLE service_tiers DROP COLUMN IF EXISTS slot_interval_minutes;
