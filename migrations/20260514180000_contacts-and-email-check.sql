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

-- Anyone (anon + authenticated) can upsert a contact by email
CREATE POLICY "anyone_insert_contacts" ON contacts
  FOR INSERT TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "anyone_update_contacts" ON contacts
  FOR UPDATE TO anon, authenticated
  USING (true);

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
