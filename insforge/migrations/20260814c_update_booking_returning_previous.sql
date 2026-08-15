-- Saves a booking and hands back what it was, in one round trip.
--
-- The dashboard save read the row and then wrote it, two calls one after the
-- other, because the history has to say what the session was moved *from* and
-- that value is gone the instant the update lands. Read and write are not
-- independent — they are the same row, and the order is the whole point — so
-- the pair could not simply be raced from the application: the read could land
-- after the write and the trail would report "de las 16:00 a las 16:00".
--
-- One statement settles it. Both branches of the CTE see the same snapshot, so
-- `previous` returns the row as it stood before the update no matter which part
-- the planner runs first, and `FOR UPDATE` holds the row while it happens —
-- which also closes a race the application could not close at all: two people
-- saving the same booking at once used to be able to read the same "before" and
-- record the same change twice.
--
-- Only the keys actually present in the payload are written, which is what
-- `.update(payload)` did: a caller that omits `staff_id` is not saying the
-- booking has nobody, it is saying it did not touch that.
--
-- Written as a single SQL statement rather than a plpgsql block on purpose:
-- migrations here are applied one statement at a time by the CLI, and a body
-- with semicolons in it never survives the trip.
CREATE OR REPLACE FUNCTION update_booking_returning_previous(
  p_id uuid,
  p_payload jsonb
)
RETURNS jsonb
LANGUAGE sql
AS $fn$
  WITH previous AS (
    SELECT to_jsonb(b) AS snapshot
    FROM bookings b
    WHERE b.id = p_id
    FOR UPDATE
  ),
  updated AS (
    UPDATE bookings SET
      service_id = CASE WHEN p_payload ? 'service_id'
        THEN p_payload->>'service_id' ELSE service_id END,
      service_title = CASE WHEN p_payload ? 'service_title'
        THEN p_payload->>'service_title' ELSE service_title END,
      tier_id = CASE WHEN p_payload ? 'tier_id'
        THEN NULLIF(p_payload->>'tier_id', '')::uuid ELSE tier_id END,
      price_eur = CASE WHEN p_payload ? 'price_eur'
        THEN NULLIF(p_payload->>'price_eur', '')::numeric ELSE price_eur END,
      duration = CASE WHEN p_payload ? 'duration'
        THEN p_payload->>'duration' ELSE duration END,
      date = CASE WHEN p_payload ? 'date'
        THEN NULLIF(p_payload->>'date', '')::date ELSE date END,
      time = CASE WHEN p_payload ? 'time'
        THEN p_payload->>'time' ELSE time END,
      location = CASE WHEN p_payload ? 'location'
        THEN p_payload->>'location' ELSE location END,
      location_address = CASE WHEN p_payload ? 'location_address'
        THEN p_payload->>'location_address' ELSE location_address END,
      staff_id = CASE WHEN p_payload ? 'staff_id'
        THEN NULLIF(p_payload->>'staff_id', '')::uuid ELSE staff_id END,
      notes = CASE WHEN p_payload ? 'notes'
        THEN p_payload->>'notes' ELSE notes END,
      first_name = CASE WHEN p_payload ? 'first_name'
        THEN p_payload->>'first_name' ELSE first_name END,
      last_name = CASE WHEN p_payload ? 'last_name'
        THEN p_payload->>'last_name' ELSE last_name END,
      email = CASE WHEN p_payload ? 'email'
        THEN p_payload->>'email' ELSE email END,
      phone = CASE WHEN p_payload ? 'phone'
        THEN p_payload->>'phone' ELSE phone END,
      status = CASE WHEN p_payload ? 'status'
        THEN p_payload->>'status' ELSE status END
    WHERE id = p_id AND EXISTS (SELECT 1 FROM previous)
    RETURNING 1
  )
  SELECT snapshot FROM previous
$fn$;
