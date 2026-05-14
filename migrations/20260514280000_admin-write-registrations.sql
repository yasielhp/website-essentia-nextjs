-- Allow admin and staff to insert, update, delete all race and education registrations
CREATE POLICY "admin_write_race_registrations"
ON public.race_registrations
FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = ANY(ARRAY['admin', 'staff']))
WITH CHECK (get_user_role(auth.uid()) = ANY(ARRAY['admin', 'staff']));

CREATE POLICY "admin_write_edu_registrations"
ON public.education_registrations
FOR ALL TO authenticated
USING (get_user_role(auth.uid()) = ANY(ARRAY['admin', 'staff']))
WITH CHECK (get_user_role(auth.uid()) = ANY(ARRAY['admin', 'staff']));
