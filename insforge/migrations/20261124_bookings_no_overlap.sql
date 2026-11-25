-- APPLIED to the live database on 2026-11-25, after the deploy and the reloaded tabs, and verified.
-- (Was: NOT APPLIED.) For the owner to decide, and to apply only AFTER the code that
-- understands the refusal is deployed (see "ORDER" below).
--
-- Nothing stopped two bookings from taking the same hour of the same
-- professional (finding (xiv) of docs/plans/2026-11-17-whatsapp-findings.md):
-- no unique index, no constraint, no trigger. The calendar's free hours
-- (`fetchAvailability`) and the hold a fresh draft keeps on its hour
-- (`app/lib/bookings/holds-slot.ts`, 60 minutes) are courtesy: they are read a
-- moment before somebody else writes. Two visitors with the calendar open, an
-- old tab, two people at the desk, or an agent's tool could end on one hour.
--
-- This makes the DATABASE refuse it, which is the only check that closes the
-- race: an exclusion constraint, `bookings_no_overlap`, over
--
--   (staff_id WITH =, booking_slot(date, time, duration) WITH &&)
--
-- for the rows that HOLD a slot: every status but `draft` and `cancelled`
-- (`pending`, `confirmed`, `completed`, `paid`), the same rule as
-- `holdsSlot` except for drafts, with a professional assigned.
--
--   - `draft` is left out ON PURPOSE. A draft is a form in progress; its hold
--     is time-limited (60 minutes from `created_at`), and "now" cannot be part
--     of a constraint. So the drafts keep the courtesy hold they have in the
--     calendar, and the database arbitrates when a draft becomes a booking:
--     the first visitor to confirm gets the hour, the second is answered
--     "Ese hueco se acaba de ocupar, elige otra hora" and no payment is
--     opened for her. Two drafts on one hour are fine; two bookings are not.
--   - `cancelled` holds nothing, as in the calendar.
--   - A booking with no professional (`staff_id` NULL: 80 confirmed rows
--     today, taken before professionals were assigned) has nobody to clash
--     with. Nor does one with no day or hour: its range is NULL, and NULL
--     overlaps nothing.
--
-- The schema keeps the moment as three text-ish columns (`date` a date,
-- `time` an `HH:MM` text, `duration` a text such as `50 min`), so the range is
-- built by `booking_slot()`, IMMUTABLE as an index requires: from `date` +
-- `time` to that + the minutes in `duration` (its digits, 60 when it has none:
-- the same reading as `parseDurationMinutes` in app/utils/format.ts, which
-- the calendar uses), half-open `[)` so 10:00–11:00 and 11:00–12:00 do not
-- clash. Wall-clock time of the Canaries, as the calendar computes it. An
-- `HH:MM` that is not one yields NULL (no range, no clash) rather than an
-- error that would refuse the write.
--
-- THE CURRENT DATA. Read on 2026-11-24 with the same rule: ONE pair of
-- bookings already overlaps, both `confirmed`, both of the professional
-- e3aec67e-4993-47be-bcf2-41e863b26db2, on 2026-09-23 (in the past):
--   f28b07df-6c16-4b91-ba09-10da2a0db222  16:30, 45 min
--   3c429a93-2863-4f91-a05d-61d16db5bc16  17:00, 45 min
-- A constraint judges every row, old ones too, so it could not be created over
-- them. History is not rewritten for it: the constraint covers bookings from
-- 2026-11-24 on (`date >= DATE '2026-11-24'`), and a booking dated before can
-- neither clash nor be clashed with (none can be taken in the past anyway).
-- Before the constraint, the file looks for any pair the rule WOULD cover and
-- stops, naming them, if there is one (a booking written between this reading
-- and the day it is applied could be one): the team settles them (another
-- hour, another professional, or cancelling one) and runs it again.
--
-- What the code does with the refusal (Postgres `23P01`, the constraint's
-- name in the message; `app/lib/bookings/slot-taken.ts`):
--   - the public form's last step answers `slot_taken`: she is sent back to
--     the calendar with the hour cleared and the message, and NO payment is
--     opened (`app/actions/public-booking.ts`, `booking-content.tsx`);
--   - the desk's "New booking" and the edit screen say "This professional
--     already has another booking at that time" in words;
--   - the agents' `create_booking` says the hour has just been taken;
--   - the Redsys webhook, when the money arrives for a booking that did not
--     hold its hour (a draft, or one the cron released as unpaid) and the
--     hour is taken now: the payment is STILL recorded, the booking stays
--     unconfirmed, the history says why and the office is told. Without the
--     code, the old handler would read the refusal as "not applied" and
--     leave the money unrecorded: that is why the code goes first.
--
-- ORDER.
--
--   1. Deploy the code (this branch).
--   2. Apply `20261124_bookings_close_browser_writes.sql` (its own order:
--      reload the open tabs first), then this. They do not depend on each
--      other, but this one needs the code: see the webhook above.
--   3. Verify (below).
--
-- Can be run again: the extension and the function are created if missing or
-- replaced, the constraint is dropped first.
--
-- Apply with the command in CLAUDE.md (comments and BEGIN/COMMIT stripped; the
-- `$$` of the functions survives because the file arrives through `$(...)`):
--   npx -y @insforge/cli@latest db query "$(grep -v '^--' insforge/migrations/20261124_bookings_no_overlap.sql | grep -v -E '^(BEGIN|COMMIT);$')"
-- If it stops with "bookings_no_overlap: these bookings already overlap", it
-- applied NOTHING (one string is one transaction): settle the pairs named and
-- run it again.
--
-- Verify afterwards:
--
--   SELECT extname FROM pg_extension WHERE extname = 'btree_gist';
--   -- expected: one row
--
--   SELECT proname, provolatile FROM pg_proc
--   WHERE proname = 'booking_slot' AND pronamespace = 'public'::regnamespace;
--   -- expected: booking_slot | i
--
--   SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--   WHERE conrelid = 'public.bookings'::regclass AND conname = 'bookings_no_overlap';
--   -- expected: one row, EXCLUDE USING gist (staff_id WITH =,
--   --   booking_slot(date, "time", duration) WITH &&) WHERE (...)
--
--   SELECT booking_slot(DATE '2026-12-01', '10:00', '50 min');
--   -- expected: ["2026-12-01 10:00:00","2026-12-01 10:50:00")
--
-- ROLLING THE CODE BACK with this applied (to `main`, or any deploy from
-- before this branch) is the dangerous direction: the old Redsys webhook reads
-- the refusal of a payment whose hour was taken as "not applied" and the
-- money goes UNRECORDED, and the old forms show Postgres' words. Drop the
-- constraint FIRST (below), then roll the code back.
--
-- Rollback:
--   ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;
--   DROP FUNCTION IF EXISTS booking_slot(date, text, text);
--   -- btree_gist may stay; nothing else uses it:
--   DROP EXTENSION IF EXISTS btree_gist;

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION booking_slot(p_date date, p_time text, p_duration text)
RETURNS tsrange
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog
AS $$
  SELECT CASE
    WHEN p_date IS NULL
      OR p_time IS NULL
      OR p_time !~ '^[0-9]{1,2}:[0-9]{2}$'
    THEN NULL
    ELSE tsrange(
      p_date + make_interval(
        hours => split_part(p_time, ':', 1)::int,
        mins => split_part(p_time, ':', 2)::int
      ),
      p_date + make_interval(
        hours => split_part(p_time, ':', 1)::int,
        mins => split_part(p_time, ':', 2)::int + CASE
          WHEN regexp_replace(coalesce(p_duration, ''), '[^0-9]', '', 'g') ~ '^[0-9]{1,4}$'
            AND regexp_replace(coalesce(p_duration, ''), '[^0-9]', '', 'g')::int > 0
          THEN regexp_replace(coalesce(p_duration, ''), '[^0-9]', '', 'g')::int
          ELSE 60
        END
      ),
      '[)'
    )
  END
$$;

DO $$
DECLARE
  clash text;
BEGIN
  SELECT string_agg(
           format('%s and %s (%s %s / %s)', a.id, b.id, a.date, a.time, b.time),
           '; '
         )
    INTO clash
    FROM bookings a
    JOIN bookings b
      ON b.staff_id = a.staff_id
     AND b.id > a.id
   WHERE a.status NOT IN ('draft', 'cancelled')
     AND b.status NOT IN ('draft', 'cancelled')
     AND a.date >= DATE '2026-11-24'
     AND b.date >= DATE '2026-11-24'
     AND booking_slot(a.date, a.time, a.duration)
         && booking_slot(b.date, b.time, b.duration);
  IF clash IS NOT NULL THEN
    RAISE EXCEPTION 'bookings_no_overlap: these bookings already overlap, settle them first: %', clash;
  END IF;
END
$$;

ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_no_overlap;
ALTER TABLE bookings ADD CONSTRAINT bookings_no_overlap
  EXCLUDE USING gist (
    staff_id WITH =,
    booking_slot(date, time, duration) WITH &&
  )
  WHERE (
    status NOT IN ('draft', 'cancelled')
    AND staff_id IS NOT NULL
    AND date >= DATE '2026-11-24'
  );

COMMIT;
