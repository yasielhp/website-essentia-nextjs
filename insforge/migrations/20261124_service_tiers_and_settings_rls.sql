-- NOT APPLIED. For the owner to decide, and to apply only AFTER the code that
-- saves a session type through the server is deployed (see "ORDER" below).
--
-- Two tables, closed TOGETHER, in one file so they cannot be applied apart:
--
--   `service_settings`  the services (a row each: its name, whether it is
--                       offered). 9 rows, 4 offered.
--   `service_tiers`     the session types of each service and their prices:
--                       what the public booking flow charges (`price_eur`),
--                       what the site prints on its treatment cards and what
--                       the agent tools answer with. 27 rows, 24 on sale.
--
-- Both were created without row level security, and the default grants of
-- the schema give the two browser roles everything (`pg_default_acl` on
-- `public`: `anon=arwd`, `authenticated=arwd` for every new table). Read from
-- the live catalogues on 2026-11-24, for both:
--
--   - `pg_class.relrowsecurity` = false, and no policy;
--   - `anon` and `authenticated` each hold SELECT, INSERT, UPDATE and DELETE
--     (`information_schema.role_table_grants`);
--   - the public key reads every row, the ones switched off included.
--
-- So anybody holding the public key, which every visitor's browser has, could
-- change a price, switch a session type off or delete one; and, on the
-- parent, rename a service, switch it off, change its `price_eur` (nothing
-- reads that column today) or DELETE it, which deletes its session types too.
--
-- WHY THE TWO GO TOGETHER. `service_tiers.service_id` points at
-- `service_settings(id)` ON DELETE CASCADE, and a cascade is carried out by
-- the database itself, which row security does not hold back. With only
-- `service_tiers` closed, a DELETE on `service_settings` with the public key
-- would still delete every session type of that service, and through their
-- own foreign keys the staff assignments (`staff_tiers`) and the voucher
-- plans (`bonus_plans`) of each, and leave its bookings with no session type
-- (`bookings.tier_id` is SET NULL). Only a session type that a voucher
-- already bought points at would stop it (`contact_bonuses` and
-- `bonus_orders` are ON DELETE RESTRICT). Closing one table and not the
-- other closes nothing: the earlier version of this file, which closed
-- `service_tiers` alone, said "no browser key writes", and through the
-- cascade that was not true.
--
-- What this does, for each of the two:
--
--   1. Turns row level security on.
--   2. Lets everybody READ the rows that are on (`active`).
--        `service_tiers`: it is what the public reads and all it reads. The
--        booking form lists them with `active = true` (`duration-step.tsx`),
--        the treatment cards and the agent tools do the same through
--        `listPublicTierPrices`, and the last step of the form reads the price
--        of the one being booked by its id (`confirm-step.tsx`). A visitor has
--        no use for one that was switched off, so those are not hers to read.
--        `service_settings`: no anonymous page reads it today. Its one reader
--        with a browser key is the dashboard's booking form, new and edit
--        (`bookable-services.client.ts`: `id, title` where `active = true`);
--        every other reader uses the service key (`calendar-config.service.ts`).
--        The names of the services on offer are on the site for anyone, so
--        the rule is the same as its child's and a public read added later
--        needs no migration.
--   3. Lets the TEAM (admin, staff and partner: the roles that enter the
--      dashboard) read every row, on or off, through the SECURITY DEFINER
--      `get_user_role(auth.uid())` that the other tables' policies use.
--      Settings lists the session types switched off so they can be switched
--      back on, checks every colour (the unique index counts them all), and
--      the calendar and the bookings list print the name and the colour of a
--      booking whose session type was switched off afterwards.
--   4. Gives NO policy for INSERT, UPDATE or DELETE, and takes those three
--      grants away from the browser roles. With RLS on and no policy they are
--      refused already; the REVOKE is the second lock, so a table does not
--      become writable again the day somebody turns its RLS off. The service
--      key is held by neither role (its own bypasses RLS and owns the tables)
--      and it is the only writer: `saveSessionType` (app/actions/
--      session-types.ts), for administrators, writes `service_tiers` and
--      `staff_tiers`; nothing in the code writes `service_settings` (checked
--      in app/, scripts/, i18n/ and the root, here and on `main`), which is
--      changed in the database. A test (`app/actions/session-types.test.ts`)
--      keeps it that way in the source; this file is what holds in the
--      database.
--
-- What it does NOT change: every reader on the server uses the service key
-- (checkout, the booking draft, the vouchers, the reminders, the calendar
-- sync, the campaigns' audience, the MCP tools). No SQL function, view,
-- trigger or policy mentions either table (checked in `pg_proc`, `pg_views`,
-- `pg_trigger` and `pg_policies`). The foreign keys that point at
-- `service_tiers` (bookings, staff_tiers, bonus_plans, contact_bonuses,
-- bonus_orders) are checked by the database itself.
--
-- What it does NOT close. `staff_tiers` already has RLS and only an
-- administrator's session may write it. Six more tables are as open as these
-- two were (RLS off, every grant to the browser roles): `booking_events`
-- (migration `20261117m`, also not applied), `account_locks`, `auth_events`,
-- `booking_calendar_mirrors`, `membership_plans` and `memberships`; and
-- `bookings` has RLS but lets the public key INSERT a booking with any
-- status and price. They are listed, for a decision, in
-- docs/plans/2026-11-17-whatsapp-findings.md (v).
--
-- One visible difference: a visitor who is on the last step of a booking at
-- the moment its session type is switched off no longer has the price read
-- again there, so the step keeps showing the price it was handed by the step
-- before. The amount charged is decided on the server either way.
--
-- ORDER.
--
--   1. Deploy the code (this branch).
--   2. RELOAD every tab that has Settings open (or close them). A tab opened
--      before the deploy still runs the old screen, which writes
--      `service_tiers` from the browser, as the signed-in administrator, and
--      does not look at the answer: with this applied it would say "saved"
--      and close with nothing saved.
--   3. Apply this, and verify (below).
--
-- Applied BEFORE the deploy, the same happens to everybody: the modal of
-- Settings that is in production writes from the browser and would stop
-- saving without saying so. Nothing else of the old code is affected (its
-- reads are the ones listed above). Applied after, nothing breaks. Between
-- the deploy and this, everything works and the tables are still writable
-- with the public key, so it should follow at once.
--
-- ROLLING THE CODE BACK after this is applied (to `main`, or any deploy from
-- before this branch) brings the old modal back, and the save of a session
-- type breaks again in silence: "saved", and nothing saved. Roll this back
-- first (below), or do not roll the code back.
--
-- Can be run again: enabling RLS and revoking twice are no-ops, and the
-- policies are dropped first because `CREATE POLICY` has no `IF NOT EXISTS`.
--
-- Verify afterwards (a string that opens with a comment is read by the CLI as
-- an option and nothing is applied, which looks like success):
--
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE oid IN ('public.service_tiers'::regclass,
--                 'public.service_settings'::regclass)
--   ORDER BY relname;
--   -- expected: true for both
--
--   SELECT tablename, policyname, cmd, roles::text, qual FROM pg_policies
--   WHERE schemaname = 'public'
--     AND tablename IN ('service_tiers', 'service_settings')
--   ORDER BY tablename, policyname;
--   -- expected: exactly four rows, all SELECT, two per table:
--   --   anyone_read_active_<table> | {anon,authenticated} | active
--   --   team_read_all_<table>      | {authenticated}      | the three roles
--
--   SELECT table_name, grantee,
--          string_agg(privilege_type, ',' ORDER BY privilege_type) AS privs
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public'
--     AND table_name IN ('service_tiers', 'service_settings')
--     AND grantee IN ('anon', 'authenticated')
--   GROUP BY table_name, grantee ORDER BY table_name, grantee;
--   -- expected: four rows, each with SELECT and nothing else
--
-- Rollback (back to how it was, writable from the browser again), for each
-- of the two tables:
--   DROP POLICY IF EXISTS "anyone_read_active_<table>" ON <table>;
--   DROP POLICY IF EXISTS "team_read_all_<table>" ON <table>;
--   ALTER TABLE <table> DISABLE ROW LEVEL SECURITY;
--   GRANT INSERT, UPDATE, DELETE ON <table> TO anon, authenticated;

BEGIN;

ALTER TABLE service_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_active_service_settings" ON service_settings;
CREATE POLICY "anyone_read_active_service_settings" ON service_settings
  FOR SELECT TO anon, authenticated
  USING (active);

DROP POLICY IF EXISTS "team_read_all_service_settings" ON service_settings;
CREATE POLICY "team_read_all_service_settings" ON service_settings
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin', 'staff', 'partner']));

REVOKE INSERT, UPDATE, DELETE ON service_settings FROM anon, authenticated;

ALTER TABLE service_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_active_service_tiers" ON service_tiers;
CREATE POLICY "anyone_read_active_service_tiers" ON service_tiers
  FOR SELECT TO anon, authenticated
  USING (active);

DROP POLICY IF EXISTS "team_read_all_service_tiers" ON service_tiers;
CREATE POLICY "team_read_all_service_tiers" ON service_tiers
  FOR SELECT TO authenticated
  USING (get_user_role(auth.uid()) = ANY (ARRAY['admin', 'staff', 'partner']));

REVOKE INSERT, UPDATE, DELETE ON service_tiers FROM anon, authenticated;

COMMIT;
