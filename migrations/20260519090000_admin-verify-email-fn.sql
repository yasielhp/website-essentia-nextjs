-- Función para que el admin marque el email de un usuario como verificado
CREATE OR REPLACE FUNCTION public.admin_verify_email(p_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET email_verified = true, updated_at = NOW()
  WHERE email = p_email;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_email;
  END IF;
END;
$$;
