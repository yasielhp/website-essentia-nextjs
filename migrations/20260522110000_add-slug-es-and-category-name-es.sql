-- Add Spanish slug to blog_posts and Spanish name to blog_categories
ALTER TABLE blog_posts
  ADD COLUMN IF NOT EXISTS slug_es TEXT UNIQUE;

ALTER TABLE blog_categories
  ADD COLUMN IF NOT EXISTS name_es TEXT,
  ADD COLUMN IF NOT EXISTS slug_es TEXT UNIQUE;
