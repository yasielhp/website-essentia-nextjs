-- Fix: admin ALL policies missing WITH CHECK (blocks INSERT)
-- Fix: make get_user_role STABLE for better RLS performance

ALTER FUNCTION public.get_user_role(uuid) STABLE;

-- Races
DROP POLICY IF EXISTS admin_manage_races ON public.races;
CREATE POLICY admin_manage_races ON public.races
  FOR ALL TO authenticated
  USING     (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Education sessions
DROP POLICY IF EXISTS admin_manage_education ON public.education_sessions;
CREATE POLICY admin_manage_education ON public.education_sessions
  FOR ALL TO authenticated
  USING     (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Staff services
DROP POLICY IF EXISTS admin_manage_staff_services ON public.staff_services;
CREATE POLICY admin_manage_staff_services ON public.staff_services
  FOR ALL TO authenticated
  USING     (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Bookings: admin update (already exists, add WITH CHECK)
DROP POLICY IF EXISTS admin_update_any_booking ON public.bookings;
CREATE POLICY admin_update_any_booking ON public.bookings
  FOR UPDATE TO authenticated
  USING     (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');

-- Profiles: admin update
DROP POLICY IF EXISTS admin_update_any_profile ON public.profiles;
CREATE POLICY admin_update_any_profile ON public.profiles
  FOR UPDATE TO authenticated
  USING     (get_user_role(auth.uid()) = 'admin')
  WITH CHECK (get_user_role(auth.uid()) = 'admin');
