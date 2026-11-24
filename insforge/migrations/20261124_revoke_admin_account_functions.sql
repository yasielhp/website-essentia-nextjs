-- NOT APPLIED. Can be applied AT ONCE: it does not depend on any deploy.
--
-- Three SECURITY DEFINER functions change accounts in `auth.users` and check
-- NOTHING about who calls them, and EXECUTE on each is granted to PUBLIC
-- (`proacl` `=X/project_admin`, read on the live database on 2026-11-24):
--
--   admin_set_user_password(p_user_id uuid, p_new_password text)
--       sets any account's password
--   admin_update_user_email(p_user_id uuid, p_new_email text)
--       changes any account's address (auth.users and auth.identities)
--   admin_verify_email(p_email text)
--       marks any address as verified
--
-- So the public key, which every visitor's browser holds, can take over any
-- account, an administrator's included, with one call to `/rpc/...`. A
-- SECURITY DEFINER function runs as its owner and ignores RLS and grants on
-- the tables: the only thing that holds it back is who may EXECUTE it.
--
-- The comment of `20260905b_campaigns_lock_down.sql` says `record_campaign_event`
-- loses EXECUTE "the way `admin_set_user_password` did". It had not: the
-- grant to PUBLIC was still there on 2026-11-24.
--
-- What this does: REVOKE EXECUTE on the three from PUBLIC, `anon` and
-- `authenticated`. `project_admin` (the role behind the service key, which
-- owns them) keeps its own grant. The only caller in the code is
-- `app/actions/set-user-password.ts`, which checks the caller's role (an
-- administrator, or the person changing her own password) and calls
-- `admin_set_user_password` with the SERVICE KEY (`getAdminClient()`);
-- nothing in the code calls the other two (checked in app/ and scripts/).
-- Nothing else changes.
--
-- Can be run again: revoking what is not granted is a no-op.
--
-- Apply with the command in CLAUDE.md (comments stripped):
--   npx -y @insforge/cli@latest db query "$(grep -v '^--' insforge/migrations/20261124_revoke_admin_account_functions.sql | grep -v -E '^(BEGIN|COMMIT);$')"
--
-- Verify afterwards (false, false, true for each of the three):
--
--   SELECT p.proname, r.rolname,
--          has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
--   FROM pg_proc p
--   CROSS JOIN (VALUES ('anon'), ('authenticated'), ('project_admin')) AS r(rolname)
--   WHERE p.pronamespace = 'public'::regnamespace
--     AND p.proname IN ('admin_set_user_password', 'admin_update_user_email',
--                       'admin_verify_email')
--   ORDER BY 1, 2;
--
-- Then change a password from the dashboard (Users, or "My account") to see
-- the service key still reaches it.
--
-- Rollback (reopens them to everybody; do not):
--   GRANT EXECUTE ON FUNCTION public.admin_set_user_password(uuid, text),
--     public.admin_update_user_email(uuid, text), public.admin_verify_email(text)
--     TO PUBLIC;

BEGIN;

REVOKE EXECUTE ON FUNCTION
  public.admin_set_user_password(uuid, text),
  public.admin_update_user_email(uuid, text),
  public.admin_verify_email(text)
FROM PUBLIC, anon, authenticated;

COMMIT;
