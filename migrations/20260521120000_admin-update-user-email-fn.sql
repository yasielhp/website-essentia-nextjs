-- Función para que el admin cambie el email de autenticación de cualquier usuario
-- SECURITY DEFINER: se ejecuta con los permisos del propietario de la función
-- (que tiene acceso a auth.users), sin importar quién la llame.
CREATE OR REPLACE FUNCTION public.admin_update_user_email(p_user_id UUID, p_new_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET
    email                    = p_new_email,
    email_confirmed_at       = NOW(),
    updated_at               = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  -- Sync the identity record so the email/password provider reflects the new email
  UPDATE auth.identities
  SET
    identity_data = jsonb_set(identity_data, '{email}', to_jsonb(p_new_email)),
    updated_at    = NOW()
  WHERE user_id = p_user_id
    AND provider = 'email';
END;
$$;

-- Solo service_role puede llamar esta función
REVOKE EXECUTE ON FUNCTION public.admin_update_user_email(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_update_user_email(UUID, TEXT) TO service_role;
