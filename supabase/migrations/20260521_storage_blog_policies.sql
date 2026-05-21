-- Create the blog bucket (public) if it does not exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('blog', 'blog', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users (admin/staff) to upload to the blog bucket
CREATE POLICY "authenticated_upload_blog"
ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'blog');

CREATE POLICY "authenticated_update_blog"
ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'blog')
WITH CHECK (bucket_id = 'blog');

CREATE POLICY "authenticated_delete_blog"
ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'blog');

-- Allow public read access to blog bucket objects
CREATE POLICY "public_read_blog"
ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'blog');
