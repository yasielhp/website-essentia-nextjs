-- Función para que el admin cambie la contraseña de cualquier usuario
-- SECURITY DEFINER: se ejecuta con los permisos del propietario de la función
-- (que tiene acceso a auth.users), sin importar quién la llame.
CREATE OR REPLACE FUNCTION public.admin_set_user_password(p_user_id UUID, p_new_password TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE auth.users
  SET
    encrypted_password = crypt(p_new_password, gen_salt('bf')),
    updated_at          = NOW()
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;
END;
$$;

-- Solo service_role puede llamar esta función (la service key de insforge)
REVOKE EXECUTE ON FUNCTION public.admin_set_user_password(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.admin_set_user_password(UUID, TEXT) TO service_role;
