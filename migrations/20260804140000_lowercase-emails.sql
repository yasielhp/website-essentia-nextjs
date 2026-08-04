-- Normalise stored email addresses to lowercase, and keep them that way.
--
-- Both tables carry a unique index on email, so lowercasing can collide:
-- `Jane@x.com` and `jane@x.com` are two rows today and one row afterwards.
-- Merging them is a judgement call — bookings and registrations reference
-- `contacts.id`, so picking a winner means re-pointing those rows — therefore
-- this migration refuses to run rather than guess.
--
-- Run this first to see whether you have any:
--
--   SELECT lower(email) AS normalised, count(*), array_agg(email)
--   FROM contacts WHERE email IS NOT NULL
--   GROUP BY 1 HAVING count(*) > 1;
--
--   SELECT lower(email) AS normalised, count(*), array_agg(email)
--   FROM profiles WHERE email IS NOT NULL
--   GROUP BY 1 HAVING count(*) > 1;

DO $$
DECLARE
  v_contact_dupes INT;
  v_profile_dupes INT;
BEGIN
  SELECT count(*) INTO v_contact_dupes FROM (
    SELECT lower(email) FROM contacts WHERE email IS NOT NULL
    GROUP BY lower(email) HAVING count(*) > 1
  ) d;

  SELECT count(*) INTO v_profile_dupes FROM (
    SELECT lower(email) FROM profiles WHERE email IS NOT NULL
    GROUP BY lower(email) HAVING count(*) > 1
  ) d;

  IF v_contact_dupes > 0 OR v_profile_dupes > 0 THEN
    RAISE EXCEPTION
      'Lowercasing would violate the unique email index: % duplicate group(s) in contacts, % in profiles. Merge them first — see the queries at the top of this file.',
      v_contact_dupes, v_profile_dupes;
  END IF;
END $$;

UPDATE contacts SET email = lower(email)
WHERE email IS NOT NULL AND email <> lower(email);

UPDATE profiles SET email = lower(email)
WHERE email IS NOT NULL AND email <> lower(email);

-- Keep future writes normalised at the database level.
--
-- The application lowercases on the screens that were updated, but contacts are
-- also written by the booking RPC, the membership screen, race and education
-- registrations and the newsletter sync. A trigger covers every path, including
-- ones added later.
CREATE OR REPLACE FUNCTION public.lowercase_email()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_lowercase_email ON contacts;
CREATE TRIGGER contacts_lowercase_email
  BEFORE INSERT OR UPDATE OF email ON contacts
  FOR EACH ROW EXECUTE FUNCTION public.lowercase_email();

DROP TRIGGER IF EXISTS profiles_lowercase_email ON profiles;
CREATE TRIGGER profiles_lowercase_email
  BEFORE INSERT OR UPDATE OF email ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.lowercase_email();
