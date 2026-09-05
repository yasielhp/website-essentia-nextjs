-- Two campaigns with the same name are two rows the admin cannot tell apart
-- in the list. The form checks before saving; the index is the guarantee.
-- Case-insensitive and trimmed, because "Otoño" and "otoño " are the same
-- campaign to a human.
CREATE UNIQUE INDEX IF NOT EXISTS campaigns_unique_name
  ON campaigns (lower(trim(name)));
