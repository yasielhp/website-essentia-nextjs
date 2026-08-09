-- One colour, one session type.
--
-- The dashboard calendar is read by colour: two treatments sharing one makes
-- the week unreadable. Enforced here as well as in the form, because the form
-- can be raced by two people editing at once.
--
-- Lowercased because the colour input emits lowercase hex but hand-written
-- values may not, and #FF0000 is the same colour as #ff0000.
CREATE UNIQUE INDEX IF NOT EXISTS service_tiers_color_unique
  ON service_tiers (lower(color))
  WHERE color IS NOT NULL;
