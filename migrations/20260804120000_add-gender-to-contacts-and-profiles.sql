-- Gender on both people tables: clients and leads live in `contacts`,
-- staff accounts in `profiles`.
--
-- Nullable on purpose: every existing row keeps NULL, meaning "not specified".
-- The CHECK allows NULL, so no back-fill is needed and nothing breaks.

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS gender text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'contacts_gender_check'
  ) THEN
    ALTER TABLE contacts ADD CONSTRAINT contacts_gender_check
      CHECK (gender IS NULL OR gender IN ('female', 'male', 'other'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_gender_check'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_gender_check
      CHECK (gender IS NULL OR gender IN ('female', 'male', 'other'));
  END IF;
END $$;

-- The public booking flow upserts contacts through this function, so it needs
-- to carry the new field. `p_gender` defaults to NULL and COALESCE keeps the
-- stored value when a returning client leaves the field blank — an omission
-- must not erase what was recorded before.
CREATE OR REPLACE FUNCTION public.upsert_contact(
  p_email      TEXT,
  p_first_name TEXT,
  p_last_name  TEXT,
  p_phone      TEXT,
  p_language   TEXT DEFAULT 'en',
  p_gender     TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO contacts (email, first_name, last_name, phone, preferred_language, gender)
  VALUES (p_email, p_first_name, p_last_name, p_phone, p_language, p_gender)
  ON CONFLICT (email) DO UPDATE SET
    first_name         = EXCLUDED.first_name,
    last_name          = EXCLUDED.last_name,
    phone              = EXCLUDED.phone,
    preferred_language = EXCLUDED.preferred_language,
    gender             = COALESCE(EXCLUDED.gender, contacts.gender),
    updated_at         = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
