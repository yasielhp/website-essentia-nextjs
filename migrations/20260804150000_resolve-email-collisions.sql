-- Clear the way for lowercasing emails.
--
-- Two groups differ only in case, and they are opposite problems:
--
--   alexxelaphoto@gmail.com — "prueba prueba" and "ASDA ASA", same phone, no
--   bookings or registrations. Test rows; deleted.
--
--   notiene@gmail.com — HOLLIE JADE DIXON and ALEXANDER THOMAS HART, different
--   phones, one booking each. NOT a duplicate: two real clients sharing a
--   placeholder address because neither has email. Merging them would fuse two
--   people and misattribute a booking, so their address is cleared instead.
--
-- Run this before 20260804140000_lowercase-emails.sql.

-- ── Clients genuinely without an email ────────────────────────────────────────
--
-- The column was NOT NULL, which is why a placeholder was invented in the first
-- place. Postgres allows any number of NULLs under a unique index, so this both
-- resolves the collision and stops it recurring. It also fixes the dashboard
-- contact form, which already let the field be left empty.
ALTER TABLE contacts ALTER COLUMN email DROP NOT NULL;

UPDATE contacts
SET email = NULL
WHERE lower(email) = 'notiene@gmail.com';

-- ── Test rows ─────────────────────────────────────────────────────────────────
--
-- Guarded on having no dependent rows, so this cannot quietly remove a contact
-- that acquired a booking between writing and running the migration.
DELETE FROM contacts c
WHERE lower(c.email) = 'alexxelaphoto@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.contact_id = c.id)
  AND NOT EXISTS (
    SELECT 1 FROM race_registrations r WHERE r.contact_id = c.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM education_registrations e WHERE e.contact_id = c.id
  );

-- ── Verify ────────────────────────────────────────────────────────────────────
DO $$
DECLARE v_dupes INT;
BEGIN
  SELECT count(*) INTO v_dupes FROM (
    SELECT lower(email) FROM contacts WHERE email IS NOT NULL
    GROUP BY lower(email) HAVING count(*) > 1
  ) d;

  IF v_dupes > 0 THEN
    RAISE EXCEPTION
      'Still % duplicate email group(s) in contacts — inspect them before lowercasing.',
      v_dupes;
  END IF;
END $$;
