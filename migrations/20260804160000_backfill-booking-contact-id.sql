-- Link historical bookings to their contact.
--
-- 81 of 100 bookings carry no `contact_id`: the dashboard's booking form never
-- set one, only the public flow did. A client's own page therefore showed no
-- history. The application now matches on email as well, but backfilling the
-- column keeps the relationship explicit and lets `contact_id` be used for
-- joins and counts.
--
-- Matching is case-insensitive because booking emails were never normalised —
-- `HAMSE.BOUWBEDRIJF@TELENET.BE` in bookings, lowercase in contacts.
--
-- Run after 20260804140000_lowercase-emails.sql.

UPDATE bookings b
SET contact_id = c.id
FROM contacts c
WHERE b.contact_id IS NULL
  AND b.email IS NOT NULL
  AND c.email IS NOT NULL
  AND lower(b.email) = lower(c.email);

-- Booking addresses are normalised too, so future comparisons need no lower().
UPDATE bookings
SET email = lower(email)
WHERE email IS NOT NULL AND email <> lower(email);

DROP TRIGGER IF EXISTS bookings_lowercase_email ON bookings;
CREATE TRIGGER bookings_lowercase_email
  BEFORE INSERT OR UPDATE OF email ON bookings
  FOR EACH ROW EXECUTE FUNCTION public.lowercase_email();

-- How many are still unlinked, and why: these are bookings whose address never
-- made it into contacts. Harmless, but worth a look.
--
--   SELECT count(*) FROM bookings WHERE contact_id IS NULL;
--   SELECT DISTINCT email FROM bookings b
--   WHERE b.contact_id IS NULL AND b.email IS NOT NULL;
