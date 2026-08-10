-- Which bookings are already on which calendar.
--
-- `bookings.google_event_id` holds one event id, which was enough while a
-- booking only ever went to one calendar: the professional's, or the service's.
-- An administrator's calendar mirrors the whole centre, so the same booking now
-- belongs on two — and with a single column the second sync would look at a row
-- that already had an id and decide there was nothing to do.
--
-- One row per booking per calendar owner. The unique index is what makes the
-- sync repeatable: running it twice finds the row and skips.
CREATE TABLE IF NOT EXISTS booking_calendar_mirrors (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  -- Whose calendar it landed on.
  owner_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The `id` Google gave the event, so it can be updated or removed later.
  event_id   text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS booking_calendar_mirrors_unique
  ON booking_calendar_mirrors (booking_id, owner_id);

CREATE INDEX IF NOT EXISTS booking_calendar_mirrors_owner_idx
  ON booking_calendar_mirrors (owner_id);
