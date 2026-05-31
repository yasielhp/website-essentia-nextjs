-- Add per-location pricing to service_tiers
-- price_center_eur: price when the session takes place in the treatment centre
-- price_suite_eur:  price when the session takes place in a private Baobab suite

ALTER TABLE service_tiers
  ADD COLUMN IF NOT EXISTS price_center_eur numeric(10, 2),
  ADD COLUMN IF NOT EXISTS price_suite_eur  numeric(10, 2);
