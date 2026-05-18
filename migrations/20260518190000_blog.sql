-- Blog categories
CREATE TABLE blog_categories (
  id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

-- Blog posts
CREATE TABLE blog_posts (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  slug            text NOT NULL UNIQUE,
  excerpt         text,
  content         text,
  cover_image_url text,
  cover_image_key text,
  category_id     uuid REFERENCES blog_categories(id) ON DELETE SET NULL,
  author_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published')),
  published_at    timestamptz,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  -- SEO
  seo_title       text,
  seo_description text,
  seo_og_image_url text
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_blog_posts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION update_blog_posts_updated_at();

-- RLS
ALTER TABLE blog_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE blog_posts      ENABLE ROW LEVEL SECURITY;

-- Anyone can read categories
CREATE POLICY "public read categories"
  ON blog_categories FOR SELECT USING (true);

-- Anyone can read published posts
CREATE POLICY "public read published posts"
  ON blog_posts FOR SELECT USING (status = 'published');

-- Admin/staff can do everything
CREATE POLICY "admin full categories"
  ON blog_categories FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','staff'))
  );

CREATE POLICY "admin full posts"
  ON blog_posts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','staff'))
  );
