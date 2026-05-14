-- ─────────────────────────────────────────────────────────────
-- Make user_id nullable (guests can register with just a contact_id)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE race_registrations ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE education_registrations ALTER COLUMN user_id DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- Add contact_id columns
-- ─────────────────────────────────────────────────────────────
ALTER TABLE race_registrations ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);
ALTER TABLE education_registrations ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id);

-- ─────────────────────────────────────────────────────────────
-- Replace old unique constraints with partial indexes
-- ─────────────────────────────────────────────────────────────
ALTER TABLE race_registrations DROP CONSTRAINT IF EXISTS race_registrations_race_id_user_id_key;
ALTER TABLE education_registrations DROP CONSTRAINT IF EXISTS education_registrations_session_id_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS race_reg_user_unique ON race_registrations(race_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS race_reg_contact_unique ON race_registrations(race_id, contact_id) WHERE contact_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS edu_reg_user_unique ON education_registrations(session_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS edu_reg_contact_unique ON education_registrations(session_id, contact_id) WHERE contact_id IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER RPCs (bypass RLS for guest registrations)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_for_race(
  p_race_id    UUID,
  p_user_id    UUID DEFAULT NULL,
  p_contact_id UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO race_registrations (race_id, user_id, contact_id)
  VALUES (p_race_id, p_user_id, p_contact_id);
EXCEPTION WHEN unique_violation THEN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.register_for_education(
  p_session_id UUID,
  p_user_id    UUID DEFAULT NULL,
  p_contact_id UUID DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO education_registrations (session_id, user_id, contact_id)
  VALUES (p_session_id, p_user_id, p_contact_id);
EXCEPTION WHEN unique_violation THEN NULL;
END;
$$;
