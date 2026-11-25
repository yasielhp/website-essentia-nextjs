-- APPLIED to the live database on 2026-11-25, after the deploy and the reloaded tabs, and verified.
-- (Was: NOT APPLIED.) For the owner to decide, then apply when deploying.
--
-- A signed-in user can rewrite the email of her OWN profile from the browser.
-- Read from the live catalogues on 2026-11-17:
--
--   - policy `users_update_own_profile`: UPDATE for `authenticated`, with
--     `id = auth.uid()` on both sides and no word about columns;
--   - `authenticated` holds the UPDATE privilege on `profiles.email`;
--   - the only triggers are `profiles_guard_role`, which protects `role` and
--     nothing else, and `profiles_lowercase_email`.
--
-- Why it matters: `profiles.email` is read as an address the person has
-- proven. `authenticate()` (app/lib/auth-guard.ts) answered
-- `profile.email ?? session.user.email`, and the newsletter and consent
-- actions act on that address. A client who writes somebody else's address
-- on her own profile can then unsubscribe that person, or have her own
-- consent recorded on that person's contact. The code no longer trusts the
-- column for this (the guard hands out the session's address apart), and this
-- migration closes the door underneath it.
--
-- What it does: the guard that already keeps `role` out of a user's own hands
-- keeps `email` out of them too, in the same way and on the same three
-- branches. `CREATE OR REPLACE` with the same signature, so the trigger
-- `profiles_guard_role` (BEFORE INSERT OR UPDATE, every column) keeps pointing
-- at it and running it again changes nothing. The body is the live function
-- (`SELECT pg_get_functiondef('public.profiles_guard_role'::regproc)`) plus
-- the email check.
--
--   - Service key (the caller's id is not a uuid): untouched. It is how the
--     dashboard changes a staff email (`updateUserProfile`, admin only, which
--     changes the auth email in the same step).
--   - An administrator's session: untouched.
--   - Anyone else, on UPDATE: a different `email` is put back to the stored
--     one, quietly, exactly as a different `role` already is. The rest of the
--     update goes through.
--   - Anyone else, on INSERT: unchanged. No policy lets a non-administrator
--     insert a profile at all (`admin_insert_profile` is the only INSERT
--     policy), so there is no row whose email she could choose.
--
-- What it does NOT break (checked in app/ on 2026-11-17): no screen changes
-- `profiles.email` from the browser. The only browser UPDATE of `profiles` is
-- the dashboard's own-account page (first_name, last_name, full_name, phone,
-- preferred_language, avatar_url). Every other write goes through a server
-- action with the service key.
--
-- Verify afterwards (a string that opens with a comment is read by the CLI as
-- an option and nothing is applied, which looks like success):
--
--   SELECT pg_get_functiondef('public.profiles_guard_role'::regproc)
--          LIKE '%NEW.email := OLD.email%' AS guards_email;
--   -- expected: true
--
--   SELECT tgname, tgenabled FROM pg_trigger
--   WHERE tgrelid = 'public.profiles'::regclass AND NOT tgisinternal;
--   -- expected: profiles_guard_role and profiles_lowercase_email, both 'O'
--
-- Rollback: apply 20260810e_profiles_guard_role_tolerates_api_key.sql again
-- (it is the function without the email check).

BEGIN;

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

  -- The address is read as one the person has proven, so it is not hers to
  -- rewrite either. NULL counts: an empty address cannot be filled in by hand.
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    NEW.email := OLD.email;
  END IF;

  RETURN NEW;
END;
$$;

COMMIT;
