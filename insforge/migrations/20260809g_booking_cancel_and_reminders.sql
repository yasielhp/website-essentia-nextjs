-- Letting the client cancel, and reminding them before they need to.
--
-- The confirm step promises a free cancellation up to 24 hours before, but the
-- only way to act on it was to phone the centre — so the people who would have
-- cancelled simply did not turn up. The token is what makes the promise usable:
-- it goes in the confirmation email as a link, identifies one booking, and
-- carries no session, so it works from any inbox on any device.
--
-- Random and unguessable rather than the booking id, which appears in staff
-- URLs and would let anyone who saw one cancel someone else's appointment.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS cancel_token uuid NOT NULL DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS bookings_cancel_token_key
  ON bookings (cancel_token);

-- Stamped when the reminder goes out, so a job that runs every hour does not
-- email the same person every hour.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS reminder_sent_at timestamptz;
