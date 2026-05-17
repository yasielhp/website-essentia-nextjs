-- Service tiers: multiple duration+price options per service
CREATE TABLE service_tiers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id       text NOT NULL REFERENCES service_settings(id) ON DELETE CASCADE,
  label            text,
  duration_minutes integer,
  price_eur        numeric(10,2),
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX service_tiers_service_id_idx ON service_tiers (service_id, sort_order);

-- Add tier reference and price to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS tier_id   uuid REFERENCES service_tiers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS price_eur numeric(10,2);