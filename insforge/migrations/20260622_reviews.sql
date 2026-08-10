CREATE TABLE IF NOT EXISTS reviews (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  quote         text        NOT NULL,
  name          text        NOT NULL,
  age           text        NOT NULL DEFAULT '',
  initials      text        NOT NULL DEFAULT '',
  display_order integer     NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

-- Anonymous users can read published reviews (home page carousel)
CREATE POLICY "public_read_published" ON reviews
  FOR SELECT USING (status = 'published');

-- Authenticated users (staff/admin) can read all reviews including drafts
CREATE POLICY "auth_read_all" ON reviews
  FOR SELECT TO authenticated USING (true);

-- Writes belong to the dashboard, which runs in the staff member's own browser
-- with their token, so the policies are scoped to the same two roles as the
-- rest of the dashboard tables.
--
-- The public "leave a review" form does not need a policy: `submitReview` is a
-- Server Action using the service key, which bypasses RLS. These three policies
-- shipped as unconditional `(true)`, which let any account that could log in —
-- every member — write, restyle or delete the testimonials on the home page.
-- Tightened on 2026-08-10 by
-- `20260810b_tighten-contacts-and-reviews-writes.sql`.
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
