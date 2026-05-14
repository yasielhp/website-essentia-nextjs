-- ─────────────────────────────────────────────────────────────
-- Helper: get role without triggering RLS recursion
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_user_role(user_id UUID)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = user_id;
$$;

-- ─────────────────────────────────────────────────────────────
-- Profiles: admin policies (uses SECURITY DEFINER fn above)
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "admin_select_all_profiles" ON profiles
  FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin', 'staff'));

CREATE POLICY "admin_insert_profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "admin_update_any_profile" ON profiles
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Bookings: admin/staff can see all
-- ─────────────────────────────────────────────────────────────
CREATE POLICY "admin_select_all_bookings" ON bookings
  FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) IN ('admin', 'staff'));

CREATE POLICY "admin_update_any_booking" ON bookings
  FOR UPDATE TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Staff services: assigns staff to service IDs
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff_services (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  service_id  TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (staff_id, service_id)
);

ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_manage_staff_services" ON staff_services
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "staff_read_own_services" ON staff_services
  FOR SELECT TO authenticated
  USING (staff_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Races
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS races (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT,
  date             DATE NOT NULL,
  location         TEXT,
  distance_km      NUMERIC(6,2),
  max_participants INT,
  registration_url TEXT,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE races ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_races" ON races
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_races" ON races
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Race registrations
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS race_registrations (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  race_id    UUID REFERENCES races(id) ON DELETE CASCADE NOT NULL,
  user_id    UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (race_id, user_id)
);

ALTER TABLE race_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_registrations" ON race_registrations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin_read_all_registrations" ON race_registrations
  FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Education sessions
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS education_sessions (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title            TEXT NOT NULL,
  description      TEXT,
  date             TIMESTAMPTZ NOT NULL,
  duration_minutes INT,
  location         TEXT,
  max_participants INT,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

ALTER TABLE education_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_education" ON education_sessions
  FOR SELECT USING (true);

CREATE POLICY "admin_manage_education" ON education_sessions
  FOR ALL TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');

-- ─────────────────────────────────────────────────────────────
-- Education registrations
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS education_registrations (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id   UUID REFERENCES education_sessions(id) ON DELETE CASCADE NOT NULL,
  user_id      UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (session_id, user_id)
);

ALTER TABLE education_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_manage_own_edu_registrations" ON education_registrations
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin_read_all_edu_registrations" ON education_registrations
  FOR SELECT TO authenticated
  USING (public.get_user_role(auth.uid()) = 'admin');
