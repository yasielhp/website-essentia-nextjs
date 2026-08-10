-- Close the last two unconditional write policies.
--
-- `20260804190000_restrict-contact-updates.sql` took away the anonymous UPDATE
-- on `contacts` but deliberately left the INSERT alone, "worth revisiting once
-- the booking and registration flows have been watched in production for a
-- while". They have been, and the audit is now conclusive: every public path
-- that creates a contact — the booking flow, the race form, the course form and
-- the MCP `create_booking` tool — goes through `public.upsert_contact`, which is
-- SECURITY DEFINER and needs no policy. The only direct INSERTs left are the
-- dashboard screens, which run authenticated.
--
-- `reviews` never had a gate at all: `auth_insert` / `auth_update` /
-- `auth_delete` were `(true)` for every authenticated role, so any member
-- account could rewrite or delete the testimonials on the home page. The public
-- "leave a review" form is a Server Action on the service key and is unaffected.

-- ── contacts ─────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "anyone_insert_contacts" ON contacts;

CREATE POLICY "staff_insert_contacts" ON contacts
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'staff'));

-- ── reviews ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "auth_insert" ON reviews;
DROP POLICY IF EXISTS "auth_update" ON reviews;
DROP POLICY IF EXISTS "auth_delete" ON reviews;

CREATE POLICY "staff_insert" ON reviews
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'staff'));

CREATE POLICY "staff_update" ON reviews
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin', 'staff'))
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'staff'));

CREATE POLICY "staff_delete" ON reviews
  FOR DELETE TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin', 'staff'));
