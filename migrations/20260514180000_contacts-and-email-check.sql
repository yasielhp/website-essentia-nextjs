-- ─────────────────────────────────────────────────────────────
-- Add email to profiles so we can look up role by email
-- ─────────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_idx ON profiles (email) WHERE email IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- Contacts: anyone who provides their email during booking
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contacts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email       TEXT UNIQUE NOT NULL,
  first_name  TEXT,
  last_name   TEXT,
  phone       TEXT,
  user_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Public lead capture (booking, race and course registration) never writes to
-- this table directly: it calls `public.upsert_contact`, which is SECURITY
-- DEFINER and therefore needs no policy of its own. So the only client that
-- has to be allowed in is the dashboard, which runs in the staff member's own
-- browser with their token.
--
-- This file originally shipped `anyone_insert_contacts` / `anyone_update_contacts`,
-- both unconditional and both granted to `anon`, which let any visitor create
-- rows at will and overwrite the name, email, phone, gender or status of every
-- contact in the database. The UPDATE half was closed on 2026-08-04 by
-- `20260804190000_restrict-contact-updates.sql`, which also documents the
-- reasoning; the INSERT half was closed on 2026-08-10 by
-- `insforge/migrations/20260810b_tighten-contacts-and-reviews-writes.sql`.
-- Both are folded back in here so this file describes the schema that actually
-- exists.
CREATE POLICY "staff_insert_contacts" ON contacts
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) IN ('admin', 'staff'));

-- Admin/staff can read all contacts
CREATE POLICY "admin_read_contacts" ON contacts
  FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin', 'staff'));

-- ─────────────────────────────────────────────────────────────
-- Add contact_id to bookings (nullable — members book via user_id)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL;

-- ─────────────────────────────────────────────────────────────
-- RPC: check role of an email without exposing auth.users
-- Returns the role string or NULL if not found / not a member
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_email_role(p_email TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE email = p_email LIMIT 1;
$$;
