-- Where each person sits in the picker for a given session type.
--
-- Alphabetical is an arbitrary order for a team, and one global position per
-- person is too blunt: whoever usually takes Espira is not whoever usually
-- takes Pulse. Lower comes first; equal values fall back to the name, so the
-- order stays stable before anybody has been placed.
ALTER TABLE staff_tiers ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 100;
