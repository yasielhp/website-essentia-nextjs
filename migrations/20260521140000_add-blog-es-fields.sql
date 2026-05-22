-- Add Spanish-language fields to blog_posts table
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS title_es TEXT,
  ADD COLUMN IF NOT EXISTS excerpt_es TEXT,
  ADD COLUMN IF NOT EXISTS content_es TEXT,
  ADD COLUMN IF NOT EXISTS seo_title_es TEXT,
  ADD COLUMN IF NOT EXISTS seo_description_es TEXT;
