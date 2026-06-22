-- Remove the style column — all review cards always render as light
ALTER TABLE reviews DROP COLUMN IF EXISTS style;
