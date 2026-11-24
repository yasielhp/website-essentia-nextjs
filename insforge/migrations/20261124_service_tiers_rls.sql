-- NOT APPLIED. For the owner to decide, and to apply only AFTER the code that
-- saves a session type through the server is deployed (see "Order" below).
--
-- `service_tiers` holds the session types and their prices: what the public
-- booking flow charges (`price_eur`), what the site prints on its treatment
-- cards and what the agent tools answer with. It was created without row
-- level security, and the default grants of the schema give the two browser
-- roles everything. Read from the live catalogues on 2026-11-24:
--
--   - `pg_class.relrowsecurity` = false, and no policy on the table;
--   - `anon` and `authenticated` each hold SELECT, INSERT, UPDATE and DELETE
--     (`information_schema.role_table_grants`);
--   - 27 rows, 24 active and 3 switched off, and the public key reads all 27.
--
-- So anybody holding the public key, which every visitor's browser has, could
-- change a price, switch a session type off, or delete one (taking with it,
-- through the foreign keys, its staff assignments and its voucher plans).
--
-- What this does:
--
--   1. Turns row level security on.
--   2. Lets everybody READ the session types that are on sale. That is what
--      the public reads and all it reads: the booking form lists them with
--      `active = true` (`duration-step.tsx`), the treatment cards and the
--      agent tools do the same through `listPublicTierPrices`, and the last
--      step of the form reads the price of the one being booked by its id
--      (`confirm-step.tsx`). A visitor has no use for one that was switched
--      off, so those are not hers to read.
--   3. Lets the TEAM (admin, staff and partner: the roles that enter the
--      dashboard) read every row, on sale or not. Settings lists the ones
--      switched off so they can be switched back on, checks every colour
--      (the unique index counts them all), and the calendar and the bookings
--      list print the name and the colour of a booking whose session type
--      was switched off afterwards.
--   4. Gives NO policy for INSERT, UPDATE or DELETE, and takes those three
--      grants away from the browser roles. With RLS on and no policy they
--      are refused already; the REVOKE is the second lock, so the table does
--      not become writable again the day somebody turns RLS off. The service
--      key is not held by either (its role bypasses RLS and owns the table),
--      and it is the only writer: `saveSessionType` (app/actions/
--      session-types.ts), for administrators.
--
-- What it does NOT change: every reader on the server uses the service key
-- (checkout, the booking draft, the vouchers, the reminders, the calendar
-- sync, the campaigns' audience, the MCP tools). No SQL function, view,
-- trigger or policy mentions the table (checked in `pg_proc`, `pg_views`,
-- `pg_trigger` and `pg_policies`). The foreign keys that point at it
-- (bookings, staff_tiers, bonus_plans, contact_bonuses, bonus_orders) are
-- checked by the database itself, which row security does not hold back.
--
-- One visible difference: a visitor who is on the last step of a booking at
-- the moment its session type is switched off no longer has the price read
-- again there, so the step keeps showing the price it was handed by the step
-- before. The amount charged is decided on the server either way.
--
-- ORDER. Deploy the code first, then apply this. The modal of Settings that
-- is in production before that deploy writes the table from the browser, as
-- the signed-in administrator; with this applied its save is refused, and
-- that modal does not look at the answer: it would say "saved" and close
-- with nothing saved. Nothing else of the old code is affected (its reads
-- are the ones listed above). Applied after the deploy, nothing breaks.
--
-- Can be run again: enabling RLS and revoking twice are no-ops, and the
-- policies are dropped first because `CREATE POLICY` has no `IF NOT EXISTS`.
--
-- Verify afterwards (a string that opens with a comment is read by the CLI as
-- an option and nothing is applied, which looks like success):
--
--   SELECT relrowsecurity FROM pg_class
--   WHERE oid = 'public.service_tiers'::regclass;
--   -- expected: true
--
--   SELECT policyname, cmd, roles::text, qual, with_check FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'service_tiers'
--   ORDER BY policyname;
--   -- expected: exactly two rows, both SELECT:
--   --   anyone_read_active_service_tiers | {anon,authenticated} | active
--   --   team_read_all_service_tiers      | {authenticated}      | the roles
--
--   SELECT grantee, string_agg(privilege_type, ',' ORDER BY privilege_type)
--   FROM information_schema.role_table_grants
--   WHERE table_schema = 'public' AND table_name = 'service_tiers'
--     AND grantee IN ('anon', 'authenticated')
--   GROUP BY grantee ORDER BY grantee;
--   -- expected: anon | SELECT   and   authenticated | SELECT
--
-- Rollback (back to how it was, writable from the browser again):
--   DROP POLICY IF EXISTS "anyone_read_active_service_tiers" ON service_tiers;
--   DROP POLICY IF EXISTS "team_read_all_service_tiers" ON service_tiers;
--   ALTER TABLE service_tiers DISABLE ROW LEVEL SECURITY;
--   GRANT INSERT, UPDATE, DELETE ON service_tiers TO anon, authenticated;

BEGIN;

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
