-- Update upsert_contact to accept and persist preferred_language
CREATE OR REPLACE FUNCTION public.upsert_contact(
  p_email      TEXT,
  p_first_name TEXT,
  p_last_name  TEXT,
  p_phone      TEXT,
  p_language   TEXT DEFAULT 'en'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO contacts (email, first_name, last_name, phone, preferred_language)
  VALUES (p_email, p_first_name, p_last_name, p_phone, p_language)
  ON CONFLICT (email) DO UPDATE SET
    first_name         = EXCLUDED.first_name,
    last_name          = EXCLUDED.last_name,
    phone              = EXCLUDED.phone,
    preferred_language = EXCLUDED.preferred_language,
    updated_at         = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
