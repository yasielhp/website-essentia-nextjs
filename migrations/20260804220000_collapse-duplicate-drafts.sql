-- Collapse the drafts one visitor left behind on a single attempt.
--
-- The booking flow called `create_draft_booking` every time the details step
-- was submitted, so stepping back and forward — or fixing a typo in an email —
-- wrote another row. One address has eight, three of them within eight minutes
-- of each other. The code no longer does this; these are the rows it already
-- made.
--
-- Two are kept per address: the most recent, which is the attempt that got
-- furthest, and any that reached a date, since that is a visitor who chose a
-- slot rather than one who wandered off at the form.
--
-- Nothing is lost as a lead: every one of these drafts has a `contact_id`, and
-- the contact rows are untouched.
--
-- Preview before running — this is the exact set that will be deleted:
--
--   SELECT id, email, created_at, date
--   FROM bookings b
--   WHERE status = 'draft'
--     AND date IS NULL
--     AND EXISTS (
--       SELECT 1 FROM bookings n
--       WHERE n.status = 'draft'
--         AND lower(n.email) = lower(b.email)
--         AND n.created_at > b.created_at
--     )
--   ORDER BY email, created_at;

DELETE FROM bookings b
WHERE status = 'draft'
  -- Never touch a draft that reached a date; that visitor picked a slot.
  AND date IS NULL
  -- Keep the most recent draft per address: the attempt that got furthest.
  AND EXISTS (
    SELECT 1 FROM bookings n
    WHERE n.status = 'draft'
      AND lower(n.email) = lower(b.email)
      AND n.created_at > b.created_at
  );

-- Should leave one draft per address, plus any that reached a date.
--
--   SELECT email, count(*) FROM bookings WHERE status = 'draft'
--   GROUP BY email ORDER BY count(*) DESC;
