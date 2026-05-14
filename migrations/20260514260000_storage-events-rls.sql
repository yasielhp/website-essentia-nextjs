-- Allow authenticated users (admin/staff) to upload to the events bucket
CREATE POLICY "authenticated_upload_events"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket = 'events');

CREATE POLICY "authenticated_update_events"
ON storage.objects
FOR UPDATE TO authenticated
USING (bucket = 'events')
WITH CHECK (bucket = 'events');

CREATE POLICY "authenticated_delete_events"
ON storage.objects
FOR DELETE TO authenticated
USING (bucket = 'events');

-- Allow public read access to events bucket objects
CREATE POLICY "public_read_events"
ON storage.objects
FOR SELECT TO public
USING (bucket = 'events');
