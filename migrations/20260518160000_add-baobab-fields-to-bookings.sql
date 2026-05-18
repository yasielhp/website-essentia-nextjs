-- Baobab Suites booking fields
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS room_number TEXT,
  ADD COLUMN IF NOT EXISTS hotel_reservation_number TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT;
