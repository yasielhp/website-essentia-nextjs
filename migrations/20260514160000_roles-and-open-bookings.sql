-- 1. Make user_id nullable so guests can book without an account
ALTER TABLE bookings ALTER COLUMN user_id DROP NOT NULL;

-- 2. Drop old RLS policies that required authentication
DROP POLICY IF EXISTS "users_select_own_bookings" ON bookings;
DROP POLICY IF EXISTS "users_insert_own_bookings" ON bookings;
DROP POLICY IF EXISTS "users_update_own_bookings" ON bookings;

-- 3. New booking RLS policies
-- Anyone (anon + authenticated) can insert a booking
CREATE POLICY "anyone_insert_bookings" ON bookings
  FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

-- Authenticated users can read their own bookings
CREATE POLICY "users_select_own_bookings" ON bookings
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Authenticated users can update their own bookings
CREATE POLICY "users_update_own_bookings" ON bookings
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. Profiles table with roles
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  role        TEXT NOT NULL DEFAULT 'contact'
                CHECK (role IN ('admin', 'staff', 'member', 'contact')),
  full_name   TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users read their own profile
CREATE POLICY "users_select_own_profile" ON profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Users update their own profile (role is managed server-side only)
CREATE POLICY "users_update_own_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());
