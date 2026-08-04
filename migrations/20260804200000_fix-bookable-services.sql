-- Make `service_settings` describe what the centre actually offers.
--
-- Two problems, opposite in direction.
--
-- 1. `facial-therapies` has no row at all, yet the website offers it: it has a
--    page, FAQ markup, a sitemap entry and a line in llms.txt. Staff could not
--    select it when creating a booking, and — because `service_tiers.service_id`
--    has a foreign key onto this table — nobody could add a session type for it
--    either. Adding one from the settings screen fails with
--    `violates foreign key constraint "service_tiers_service_id_fkey"`.
--    So the service is unbookable and unconfigurable, with no error visible
--    anywhere until you try.
--
-- 2. Five rows are marked active whose pages only say "Coming Soon", plus
--    `functional-well-being`, which no longer has a page. `active` is the column
--    that answers "can this be booked", and for those the answer is no.

INSERT INTO service_settings (id, title, active)
VALUES ('facial-therapies', 'Facial Therapies', true)
ON CONFLICT (id) DO UPDATE SET active = true;

UPDATE service_settings
SET active = false
WHERE id IN (
  'contrast-therapy',
  'breathing-sessions',
  'hyperbaric-chambers',
  'regenerative-medicine',
  'functional-well-being'
);

-- Should list exactly the four services the website offers.
--
--   SELECT id, title FROM service_settings WHERE active ORDER BY title;
--
-- Reverse a single row when its service launches:
--
--   UPDATE service_settings SET active = true WHERE id = 'contrast-therapy';
