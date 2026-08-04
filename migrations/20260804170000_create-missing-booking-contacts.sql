-- Give every booking a contact.
--
-- 81 of 100 bookings had no `contact_id`. The previous migration links the 76
-- whose address already exists in `contacts`; these five have no contact at all,
-- because `upsert_contact` failed silently while the draft was written anyway:
--
--   draft      hannahmorrill@gmail.com     Hannah Morrill
--   draft      ushmapatel.up@gmail.com     Ushma Patel   (x2)
--   draft      concepcion.erika@gmail.com  Erika Concepción
--   confirmed  donnaprince6@gmail.com      PRINCE DONA
--
-- Status follows what the booking says about them: someone who reached a
-- confirmed booking is a client, someone who abandoned a draft is a lead —
-- which is exactly what a lead is.
--
-- Run after 20260804160000_backfill-booking-contact-id.sql.

INSERT INTO contacts (email, first_name, last_name, phone, status)
SELECT DISTINCT ON (lower(b.email))
  lower(b.email),
  b.first_name,
  b.last_name,
  b.phone,
  CASE
    WHEN bool_or(b.status <> 'draft') OVER (PARTITION BY lower(b.email))
      THEN 'client'
    ELSE 'lead'
  END
FROM bookings b
WHERE b.contact_id IS NULL
  AND b.email IS NOT NULL
  AND btrim(b.email) <> ''
  AND NOT EXISTS (
    SELECT 1 FROM contacts c WHERE lower(c.email) = lower(b.email)
  )
ORDER BY lower(b.email), b.created_at DESC;

-- Link them, and anything else still loose.
UPDATE bookings b
SET contact_id = c.id
FROM contacts c
WHERE b.contact_id IS NULL
  AND b.email IS NOT NULL
  AND c.email IS NOT NULL
  AND lower(b.email) = lower(c.email);

-- Should return 0. Anything left has no usable email.
--
--   SELECT count(*) FROM bookings WHERE contact_id IS NULL;
