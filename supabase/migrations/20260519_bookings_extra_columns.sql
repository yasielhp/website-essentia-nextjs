ALTER TABLE bookings ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS partner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS created_by_role text;
