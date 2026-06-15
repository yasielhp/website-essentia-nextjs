-- Backfill contacts from historical bookings
--
-- Logic:
--   - One contact per unique email, using the most recent booking for name/phone
--   - status = 'client' if any booking is confirmed or paid, otherwise 'lead'
--   - On conflict (email already exists): never downgrade from 'client' to 'lead';
--     only fill in missing name/phone fields
--   - Step 2 links existing bookings back to their new contact rows via contact_id

-- ── Step 1: Upsert contacts ────────────────────────────────────

WITH latest_booking AS (
  -- Most recent booking per email (for name/phone)
  SELECT DISTINCT ON (email)
    first_name,
    last_name,
    email,
    phone
  FROM bookings
  WHERE email IS NOT NULL AND trim(email) <> ''
  ORDER BY email, created_at DESC
),
email_status AS (
  -- Highest status per email across all bookings
  SELECT
    email,
    CASE
      WHEN bool_or(status = 'confirmed' OR payment_status = 'paid') THEN 'client'
      ELSE 'lead'
    END AS contact_status
  FROM bookings
  WHERE email IS NOT NULL AND trim(email) <> ''
  GROUP BY email
)
INSERT INTO contacts (first_name, last_name, email, phone, status)
SELECT
  lb.first_name,
  lb.last_name,
  lb.email,
  lb.phone,
  es.contact_status
FROM latest_booking lb
JOIN email_status es ON lb.email = es.email
ON CONFLICT (email) DO UPDATE SET
  -- Never downgrade a 'client' back to 'lead'
  status = CASE
    WHEN contacts.status = 'client'  THEN 'client'
    WHEN EXCLUDED.status = 'client'  THEN 'client'
    ELSE COALESCE(contacts.status, EXCLUDED.status, 'lead')
  END,
  -- Only fill in name/phone if the existing contact is missing them
  first_name = COALESCE(NULLIF(contacts.first_name, ''), NULLIF(EXCLUDED.first_name, '')),
  last_name  = COALESCE(NULLIF(contacts.last_name,  ''), NULLIF(EXCLUDED.last_name,  '')),
  phone      = COALESCE(NULLIF(contacts.phone,       ''), NULLIF(EXCLUDED.phone,       ''));


-- ── Step 2: Link bookings → contacts via contact_id ───────────
--
-- Bookings created from the public form have contact_id = NULL.
-- This links them to the contact row we just created/upserted
-- so future dashboard queries can join properly.

UPDATE bookings b
SET contact_id = c.id
FROM contacts c
WHERE b.email = c.email
  AND b.contact_id IS NULL
  AND b.email IS NOT NULL
  AND trim(b.email) <> '';
