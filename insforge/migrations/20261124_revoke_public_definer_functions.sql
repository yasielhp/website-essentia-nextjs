-- NOT APPLIED. Apply only AFTER this branch is deployed and the open tabs of
-- the booking form and the dashboard are reloaded (see "ORDER" below).
--
-- Seven SECURITY DEFINER functions in `public` run as their owner
-- (`project_admin`), past row level security, and on 2026-11-24 every one of
-- them could be called by `anon` and `authenticated`, the roles of the public
-- key (which every visitor's browser holds) and of a signed-in user. Read on
-- the live database that day (`pg_proc.proacl`, `has_function_privilege`,
-- `pg_get_functiondef`, `pg_policies`):
--
--   check_email_role(p_email text)                       EXECUTE for PUBLIC
--       answers the role of any address (`member`, `client`, `admin`,
--       `staff`...): whether an address has an account, and which addresses
--       are the team's.
--   upsert_contact(9 arguments)                          EXECUTE for PUBLIC
--       (default ACL) writes a contact for any address, rewrites the name,
--       phone and language of an existing one, and stamps its newsletter,
--       WhatsApp-marketing and booking-notice (`p_whatsapp`) consents, or
--       lifts its STOP. Consent forgery for anybody, with no limit.
--   promote_contact_to_client(p_contact_id uuid)         EXECUTE for PUBLIC,
--       and granted to `anon` and `authenticated` by name: turns any lead
--       into a client, by id.
--   register_for_education(p_session_id, p_user_id, p_contact_id)
--   register_for_race(p_race_id, p_user_id, p_contact_id)
--                                                        EXECUTE for PUBLIC
--       register ANY account or contact for any session or run.
--   profiles_guard_role()                                EXECUTE for PUBLIC
--       the trigger on `profiles` that keeps a user from changing her own
--       role. Harmless to call directly (Postgres refuses to run a trigger
--       function outside a trigger), and a trigger does not need its
--       caller's EXECUTE to fire (only CREATE TRIGGER checks it), so it
--       loses EXECUTE like the rest, by the rule of CLAUDE.md.
--   get_user_role(user_id uuid)                          EXECUTE for PUBLIC
--       answers the role of ANY account by its id. It cannot simply lose
--       EXECUTE: the 19 policies that use it on the live database (bookings,
--       contacts, profiles, education_*, races, race_registrations, reviews,
--       staff_services, staff_tiers) and those of the bookings and
--       service_tiers migrations call it as the querying role, always as
--       `get_user_role(auth.uid())`, always `TO authenticated`.
--
-- The other three that were open, `create_draft_booking`,
-- `update_booking_datetime` and `confirm_booking`, are NOT here: they lose
-- EXECUTE in `20261124_bookings_close_browser_writes.sql`.
--
-- Who called them, and who calls them after this branch (checked in app/,
-- scripts/ and the root, on this branch and on `main`; no edge functions are
-- deployed):
--
--   - the public booking form called `check_email_role`, `upsert_contact` and
--     `promote_contact_to_client` from the browser. Now the member check and
--     the contact are a server action (`app/actions/public-contact.ts`: a
--     strict input, rate limited per caller, the answer is "member" or not
--     and never the role, no booking-notice consent can be sent, and an
--     existing contact is never rewritten: `writeContact`, the public way),
--     and the lead becomes a client in the last step's own action
--     (`app/lib/bookings/public-booking.ts`), only for the booking's own
--     contact;
--   - the run and course registration pages (not launched: they show
--     "Coming soon") called `check_email_role`, `upsert_contact` and
--     `register_for_*` from the browser. Now `app/actions/event-registration.ts`:
--     a guest by her own contact, for an event that exists; a signed-in person
--     herself, by her verified session; only admin and staff another account;
--   - the dashboard's "New booking" called `upsert_contact` from the browser.
--     Now `linkDeskContact` (`app/actions/desk-booking.ts`), the team only;
--   - already on the server with the service key: `upsert_contact` in the
--     MCP tools (`app/lib/bookings/for-staff.ts`) and, for admin and staff at
--     the desk, `app/lib/contacts/write-contact.ts`; every public path writes
--     its contact there without it. `promote_contact_to_client` in the bonus
--     purchase, the team's confirmation (`app/lib/bookings/notify.ts`) and a
--     paid web booking (`app/services/booking-payments.service.ts`).
-- A test (`app/lib/public-definer-functions.test.ts`) reads the source and
-- fails if any module on the browser's side calls a function of the
-- database, or if anything but the modules above calls these.
--
-- What this does:
--
--   1. REVOKE EXECUTE on the first six from PUBLIC, `anon` and
--      `authenticated`. `project_admin` (the service key, which owns them)
--      keeps its own grant.
--   2. `get_user_role` keeps its signature, so every policy stays as it is,
--      but answers only for the CALLER's own account
--      (`... WHERE id = user_id AND id = auth.uid()`): the role of anybody
--      else is NULL. Every policy passes `auth.uid()`, so for them nothing
--      changes, and `profiles_guard_role` passes the caller too. EXECUTE goes
--      from PUBLIC and `anon` (no policy that calls it is for `anon`) and
--      stays for `authenticated`, by name.
--      A variant with no argument for the policies was considered and left:
--      it would mean re-creating 19 live policies and two pending migrations
--      for the same result.
--
-- ORDER.
--
--   1. Deploy the code (this branch).
--   2. RELOAD (or close) every open tab of the public booking form
--      (/booking) and of the dashboard's "New booking". A tab opened before
--      the deploy runs the old code, which calls these functions from the
--      browser: with this applied the old form books with no contact linked
--      and leaves the lead a lead, and the old desk screen saves the booking
--      with no contact. Nothing is lost but the link, and it is logged.
--   3. Apply this, and verify (below). It does not depend on
--      `20261124_bookings_close_browser_writes.sql` or
--      `20261124_bookings_no_overlap.sql`, and they do not depend on it: apply
--      it right after them, in the same sitting.
--
-- ROLLING THE CODE BACK after this is applied (to `main`, or any deploy from
-- before this branch) leaves the old forms without their contact link, their
-- member notice and the promotion to client (the bookings themselves are the
-- other migration's concern). Roll this back first (below).
--
-- Can be run again: revoking what is not granted is a no-op, and the
-- function is replaced with the same body.
--
-- Apply with the command in CLAUDE.md (comments and BEGIN/COMMIT stripped):
--   npx -y @insforge/cli@latest db query "$(grep -v '^--' insforge/migrations/20261124_revoke_public_definer_functions.sql | grep -v -E '^(BEGIN|COMMIT);$')"
--
-- Verify afterwards (a string that opens with a comment is read by the CLI as
-- an option and nothing is applied, which looks like success):
--
--   SELECT p.proname, r.rolname,
--          has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
--   FROM pg_proc p
--   CROSS JOIN (VALUES ('anon'), ('authenticated'), ('project_admin')) AS r(rolname)
--   WHERE p.pronamespace = 'public'::regnamespace
--     AND p.proname IN ('check_email_role', 'upsert_contact',
--                       'promote_contact_to_client', 'register_for_education',
--                       'register_for_race', 'profiles_guard_role',
--                       'get_user_role')
--   ORDER BY 1, 2;
--   -- expected: false, false, true for the first six; for get_user_role
--   -- false for anon, true for authenticated and project_admin
--
--   SELECT pg_get_functiondef('public.get_user_role(uuid)'::regprocedure);
--   -- expected: STABLE SECURITY DEFINER, search_path public, and the body
--   -- SELECT role FROM profiles WHERE id = user_id AND id = auth.uid();
--
-- Then, in the app: the dashboard opens and lists bookings and contacts as an
-- administrator and as staff (the policies through `get_user_role`); a
-- client changes her name in "My account" (the trigger still fires); a guest
-- booking on /booking shows its contact in the dashboard, and that contact is
-- a client once the booking is confirmed; a "New booking" at the desk links
-- its contact.
--
-- Rollback (back to how it was: open to everybody again; do not unless the
-- code is rolled back too):
--   GRANT EXECUTE ON FUNCTION public.check_email_role(text),
--     public.upsert_contact(text, text, text, text, text, text, boolean, boolean, boolean),
--     public.promote_contact_to_client(uuid),
--     public.register_for_education(uuid, uuid, uuid),
--     public.register_for_race(uuid, uuid, uuid),
--     public.profiles_guard_role(),
--     public.get_user_role(uuid)
--     TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION public.promote_contact_to_client(uuid) TO anon, authenticated;
--   CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
--    RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
--   AS $function$
--     SELECT role FROM profiles WHERE id = user_id;
--   $function$;

BEGIN;

REVOKE EXECUTE ON FUNCTION public.check_email_role(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.upsert_contact(text, text, text, text, text, text, boolean, boolean, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.promote_contact_to_client(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_for_education(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.register_for_race(uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.profiles_guard_role() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_user_role(user_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT role FROM profiles WHERE id = user_id AND id = auth.uid();
$function$;
REVOKE EXECUTE ON FUNCTION public.get_user_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role(uuid) TO authenticated;

COMMIT;
