ALTER TABLE service_tiers ADD COLUMN IF NOT EXISTS stripe_synced_price NUMERIC;
ALTER TABLE membership_plans ADD COLUMN IF NOT EXISTS stripe_synced_price NUMERIC;