-- Which member of staff performs the booking.
--
-- The public flow used to ask only for a gender preference and write it into
-- the notes as free text. Now that session types have assigned staff, the
-- visitor picks a person, and the booking says who by id: the dashboard
-- calendar, the availability check and the confirmation email all need it as
-- data, not as a line of prose.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS bookings_staff_idx ON bookings (staff_id);
