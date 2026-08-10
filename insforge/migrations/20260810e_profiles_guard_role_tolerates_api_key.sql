-- Fix: the role guard broke every service-key write to `profiles`.
--
-- `20260810c_profiles_role_is_not_self_service.sql` added a trigger that reads
-- `auth.uid()` to decide whether the caller may change a role, on the
-- assumption that a service-key caller has none. It does have one — it is just
-- not a uuid. InsForge identifies API-key callers as
-- `project-admin-with-api-key`, and casting that to uuid raises:
--
--   invalid input syntax for type uuid: "project-admin-with-api-key"
--
-- Which turned every server-side profile write into an error. Connecting a
-- member of staff's Google Calendar is one: the OAuth callback stores the
-- tokens on their profile row.
--
-- The identity is resolved defensively now. A caller whose id is not a uuid is
-- the service key, which is our own server code — it never reaches the database
-- without passing `requireRole` first, and it is the path the dashboard uses
-- for exactly this kind of administrative write.
--
-- The guard itself is unchanged for everyone else: a signed-in browser session
-- carries a real uuid, so a client or a partner still cannot promote itself.
CREATE OR REPLACE FUNCTION public.profiles_guard_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  caller uuid;
BEGIN
  BEGIN
    caller := auth.uid();
  EXCEPTION
    WHEN others THEN
      -- Not a uuid: an API-key caller, which is trusted server code.
      caller := NULL;
  END;

  IF caller IS NULL THEN
    RETURN NEW;
  END IF;

  IF public.get_user_role(caller) = 'admin' THEN
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
