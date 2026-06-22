CREATE TABLE IF NOT EXISTS reviews (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  quote         text        NOT NULL,
  name          text        NOT NULL,
  age           text        NOT NULL DEFAULT '',
  initials      text        NOT NULL DEFAULT '',
  style         text        NOT NULL DEFAULT 'light' CHECK (style IN ('dark', 'light')),
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

-- Authenticated users can create reviews (always saved as draft)
CREATE POLICY "auth_insert" ON reviews
  FOR INSERT TO authenticated WITH CHECK (true);

-- Authenticated users can update reviews (e.g. change status, reorder)
CREATE POLICY "auth_update" ON reviews
  FOR UPDATE TO authenticated USING (true);

-- Authenticated users can delete reviews
CREATE POLICY "auth_delete" ON reviews
  FOR DELETE TO authenticated USING (true);
