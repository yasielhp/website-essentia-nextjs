-- SECURITY DEFINER bypasses RLS so anon can upsert + get the ID back
-- without needing SELECT permission on the contacts table
CREATE OR REPLACE FUNCTION public.upsert_contact(
  p_email      TEXT,
  p_first_name TEXT,
  p_last_name  TEXT,
  p_phone      TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO contacts (email, first_name, last_name, phone)
  VALUES (p_email, p_first_name, p_last_name, p_phone)
  ON CONFLICT (email) DO UPDATE SET
    first_name  = EXCLUDED.first_name,
    last_name   = EXCLUDED.last_name,
    phone       = EXCLUDED.phone,
    updated_at  = NOW()
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;
