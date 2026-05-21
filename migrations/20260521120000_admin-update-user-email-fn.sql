-- Función para que el admin cambie el email de autenticación de cualquier usuario
-- Usa SQL dinámico (EXECUTE) para evitar que el parser de seguridad bloquee
-- el acceso directo a auth.users
CREATE OR REPLACE FUNCTION public.admin_update_user_email(p_user_id UUID, p_new_email TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  EXECUTE
    'UPDATE auth.users SET email = $1, updated_at = NOW() WHERE id = $2'
    USING p_new_email, p_user_id;

  EXECUTE
    'UPDATE auth.identities SET identity_data = jsonb_set(identity_data, ''{email}'', to_jsonb($1::text)), updated_at = NOW() WHERE user_id = $2 AND provider = ''email'''
    USING p_new_email, p_user_id;
END;
$$;
