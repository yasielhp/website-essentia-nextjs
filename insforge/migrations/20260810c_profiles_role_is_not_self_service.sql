-- Stop anyone from promoting themselves to admin.
--
-- `20260514160000_roles-and-open-bookings.sql` let a signed-in user update
-- their own profile row:
--
--   CREATE POLICY "users_update_own_profile" ON profiles
--     FOR UPDATE TO authenticated
--     USING (id = auth.uid()) WITH CHECK (id = auth.uid());
--
-- and noted in a comment that "role is managed server-side only". Nothing
-- enforced it. Row-level security gates *which rows* you may write, never
-- which columns, so any account — a client who booked once, a partner — could
-- send `update profiles set role = 'admin' where id = auth.uid()` with its own
-- token and land in the dashboard.
--
-- A policy cannot compare the old row with the new one, so the guard is a
-- trigger. Admins keep writing roles, including from the browser, because
-- that is how the "new user" screen works; everyone else silently keeps the
-- role they already had rather than getting an error, so a profile edit that
-- happens to send the whole row still succeeds.
CREATE OR REPLACE FUNCTION public.profiles_guard_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service-key callers (Server Actions) have no `auth.uid()`; they are
  -- already trusted and are the path the dashboard uses for admin work.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.get_user_role(auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A self-created profile starts with no privileges.
    NEW.role := 'client';
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    NEW.role := OLD.role;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_role ON profiles;

CREATE TRIGGER profiles_guard_role
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.profiles_guard_role();
