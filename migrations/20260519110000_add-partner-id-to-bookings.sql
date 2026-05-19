ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_partner_id_idx ON bookings(partner_id);
