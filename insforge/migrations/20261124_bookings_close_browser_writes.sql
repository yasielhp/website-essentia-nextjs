-- NOT APPLIED. For the owner to decide, and to apply only AFTER the code that
-- writes bookings through the server is deployed (see "ORDER" below).
--
-- `bookings` (205 rows on 2026-11-24) has row level security on, but the
-- browser could write it in three ways, read from the live catalogues on
-- 2026-11-24 (`pg_policies`, `information_schema.role_table_grants`,
-- `pg_proc`):
--
--   1. Open write POLICIES.
--        anyone_insert_bookings        INSERT {anon,authenticated}
--                                      WITH CHECK (user_id IS NULL OR
--                                                  user_id = auth.uid())
--        partners_insert_bookings      INSERT {authenticated}
--                                      WITH CHECK (partner_id = auth.uid())
--        users_update_own_bookings     UPDATE {authenticated}
--                                      USING/CHECK (user_id = auth.uid())
--        partners_update_own_bookings  UPDATE {authenticated}
--                                      USING (partner_id = auth.uid())
--        admin_update_any_booking      UPDATE {authenticated}
--                                      admin only (get_user_role)
--      With the public key, which every visitor's browser has, anybody could
--      INSERT a booking with any status, price, payment status or amount paid
--      (the public form inserted this way); a signed-in client could UPDATE
--      any column of her own booking (mark it paid, change its price); a
--      partner the same with hers.
--   2. The default GRANTS of the schema: `anon` and `authenticated` hold
--      SELECT, INSERT, UPDATE and DELETE on the table (`pg_default_acl` gives
--      `arwd` to both on every table). RLS is what held them back.
--   3. Three SECURITY DEFINER functions that write `bookings` past RLS, with
--      EXECUTE for PUBLIC (`proacl` `=X/project_admin`):
--        create_draft_booking(...)     inserts a draft with ANY contact,
--                                      account (`user_id`) and service
--        update_booking_datetime(...)  sets the day and hour of any draft
--        confirm_booking(uuid)         turns any draft into `pending`
--                                      (no caller in the code)
--      Closing the policies alone would leave these open.
--
-- What this does:
--
--   1. Keeps RLS on.
--   2. Drops the five write policies. NO policy for INSERT, UPDATE or DELETE
--      is left: the browser roles write nothing.
--   3. Re-creates the three READ policies exactly as they are, so this file
--      states all the browser may do with the table:
--        users_select_own_bookings   a client reads her own bookings, by
--                                    `user_id = auth.uid()`: the account the
--                                    booking was written for, which since this
--                                    branch is the VERIFIED session of whoever
--                                    booked (never an id sent by the browser,
--                                    never `profiles.email`, which a user can
--                                    rewrite). The account pages read exactly
--                                    this (`.eq("user_id", user.id)`).
--        admin_select_all_bookings   admin and staff read every booking (the
--                                    calendar, the lists, the edit screen,
--                                    transactions), through the SECURITY
--                                    DEFINER `get_user_role(auth.uid())`.
--        partners_read_own_bookings  a partner reads hers (`partner_id`), as
--                                    the dashboard filters them.
--   4. REVOKEs INSERT, UPDATE and DELETE from `anon` and `authenticated`: the
--      second lock, so the table is not writable again the day somebody turns
--      its RLS off.
--   5. REVOKEs EXECUTE on the three SECURITY DEFINER functions, and on
--      `update_booking_returning_previous` (SECURITY INVOKER, the dashboard's
--      edit), from PUBLIC, `anon` and `authenticated`. The service key runs as
--      `project_admin`, which owns them and keeps its own EXECUTE grant.
--
-- Who writes `bookings` after this: only the service key (`project_admin`,
-- which owns the table and bypasses RLS), from the server:
--   - the public form: `app/actions/public-booking.ts` (draft, day and hour,
--     confirmation), strict input; status, price, payment, place and account
--     decided on the server;
--   - the desk's "New booking": `app/actions/desk-booking.ts`, the team only,
--     a partner's bookings hers;
--   - the dashboard's edit, delete and payments (`booking-draft.ts`,
--     `booking-payment.ts`, `bonuses.ts`, `booking-refunds.ts`), the
--     cancellation link, the Redsys webhook, the crons, the calendar sync and
--     the MCP tools, all of which already used the service key.
-- A test (`app/lib/bookings/bookings-writes.test.ts`) reads the source and
-- fails if a browser module writes `bookings` or calls these functions; this
-- file is what holds in the database.
--
-- What it does NOT change: every read the dashboard and the account pages
-- make with the browser's key (the policies above are the ones in place), and
-- every reader on the server (service key). No view, trigger or other table's
-- policy mentions `bookings` (checked in `pg_views`, `pg_trigger`,
-- `pg_policies`).
--
-- ORDER.
--
--   1. Deploy the code (this branch).
--   2. RELOAD (or close) every open tab of the public booking form (/booking)
--      and of the dashboard (above all "New booking"). A tab opened before the
--      deploy runs the old code: the old form creates its draft with
--      `create_draft_booking` and its day and hour with
--      `update_booking_datetime` from the browser, and writes the booking
--      itself with a direct INSERT when it has no draft; the old desk screen
--      inserts the booking from the browser. With this applied all of those
--      are refused, and the old form does not stop on a refusal: it would go
--      on with no draft, no hour and, at the end, no booking.
--   3. Apply this, and verify (below).
--   4. Then `20261124_bookings_no_overlap.sql` (it does not depend on this
--      one, but it too needs the code first).
--
-- Applied BEFORE the deploy, every public booking and every desk booking is
-- refused, silently on the public form. Applied after, nothing breaks.
-- Between the deploy and this, everything works and the table is still
-- writable with the public key, so it should follow at once.
--
-- ROLLING THE CODE BACK after this is applied (to `main`, or any deploy from
-- before this branch) brings back the form that writes from the browser, and
-- public bookings stop being written. Roll this back first (below).
--
-- Can be run again: enabling RLS, revoking and dropping are no-ops the second
-- time, and each policy is dropped before it is made (`CREATE POLICY` has no
-- `IF NOT EXISTS`).
--
-- Apply with the command in CLAUDE.md (comments and BEGIN/COMMIT stripped):
--   npx -y @insforge/cli@latest db query "$(grep -v '^--' insforge/migrations/20261124_bookings_close_browser_writes.sql | grep -v -E '^(BEGIN|COMMIT);$')"
--
-- Verify afterwards (a string that opens with a comment is read by the CLI as
-- an option and nothing is applied, which looks like success):
--
--   SELECT relrowsecurity FROM pg_class WHERE oid = 'public.bookings'::regclass;
--   -- expected: true
--
--   SELECT policyname, cmd, roles::text, qual FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'bookings' ORDER BY policyname;
--   -- expected: exactly three rows, all SELECT, all {authenticated}:
--   --   admin_select_all_bookings  | get_user_role(...) admin, staff
--   --   partners_read_own_bookings | partner_id = auth.uid()
--   --   users_select_own_bookings  | user_id = auth.uid()
--
--   SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type)
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public' AND table_name = 'bookings'
--     AND grantee IN ('anon', 'authenticated')
--   GROUP BY grantee ORDER BY grantee;
--   -- expected: two rows, each with SELECT and nothing else
--
--   SELECT p.proname, r.rolname,
--          has_function_privilege(r.rolname, p.oid, 'EXECUTE') AS can_execute
--   FROM pg_proc p
--   CROSS JOIN (VALUES ('anon'), ('authenticated'), ('project_admin')) AS r(rolname)
--   WHERE p.pronamespace = 'public'::regnamespace
--     AND p.proname IN ('create_draft_booking', 'update_booking_datetime',
--                       'confirm_booking', 'update_booking_returning_previous')
--   ORDER BY 1, 2;
--   -- expected: false for anon and authenticated, true for project_admin
--
-- Rollback (back to how it was, writable from the browser again):
--   GRANT INSERT, UPDATE, DELETE ON bookings TO anon, authenticated;
--   GRANT EXECUTE ON FUNCTION create_draft_booking(uuid, uuid, text, text, text, text, text, text, text) TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION update_booking_datetime(uuid, date, text) TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION confirm_booking(uuid) TO PUBLIC;
--   GRANT EXECUTE ON FUNCTION update_booking_returning_previous(uuid, jsonb) TO PUBLIC;
--   CREATE POLICY "anyone_insert_bookings" ON bookings FOR INSERT TO anon, authenticated
--     WITH CHECK ((user_id IS NULL) OR (user_id = auth.uid()));
--   CREATE POLICY "partners_insert_bookings" ON bookings FOR INSERT TO authenticated
--     WITH CHECK (partner_id = auth.uid());
--   CREATE POLICY "users_update_own_bookings" ON bookings FOR UPDATE TO authenticated
--     USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
--   CREATE POLICY "partners_update_own_bookings" ON bookings FOR UPDATE TO authenticated
--     USING (partner_id = auth.uid());
--   CREATE POLICY "admin_update_any_booking" ON bookings FOR UPDATE TO authenticated
--     USING (get_user_role(auth.uid()) = 'admin')
--     WITH CHECK (get_user_role(auth.uid()) = 'admin');

BEGIN;

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_insert_bookings" ON bookings;
DROP POLICY IF EXISTS "partners_insert_bookings" ON bookings;
DROP POLICY IF EXISTS "users_update_own_bookings" ON bookings;
DROP POLICY IF EXISTS "partners_update_own_bookings" ON bookings;
DROP POLICY IF EXISTS "admin_update_any_booking" ON bookings;

DROP POLICY IF EXISTS "users_select_own_bookings" ON bookings;
CREATE POLICY "users_select_own_bookings" ON bookings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_select_all_bookings" ON bookings;
CREATE POLICY "admin_select_all_bookings" ON bookings
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin', 'staff']));

DROP POLICY IF EXISTS "partners_read_own_bookings" ON bookings;
CREATE POLICY "partners_read_own_bookings" ON bookings
  FOR SELECT TO authenticated
  USING (partner_id = auth.uid());

REVOKE INSERT, UPDATE, DELETE ON bookings FROM anon, authenticated;

REVOKE EXECUTE ON FUNCTION create_draft_booking(uuid, uuid, text, text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION update_booking_datetime(uuid, date, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION confirm_booking(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION update_booking_returning_previous(uuid, jsonb) FROM PUBLIC, anon, authenticated;

COMMIT;
