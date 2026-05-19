-- Allow partners to read bookings they created (where partner_id matches their user id)
CREATE POLICY "partners_read_own_bookings" ON bookings
  FOR SELECT TO authenticated
  USING (partner_id = auth.uid());

-- Allow partners to insert bookings (they create bookings for clients)
CREATE POLICY "partners_insert_bookings" ON bookings
  FOR INSERT TO authenticated
  WITH CHECK (partner_id = auth.uid());

-- Allow partners to update their own bookings
CREATE POLICY "partners_update_own_bookings" ON bookings
  FOR UPDATE TO authenticated
  USING (partner_id = auth.uid());
