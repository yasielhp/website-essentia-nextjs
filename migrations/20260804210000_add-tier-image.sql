-- An image per session type.
--
-- The service picker shows a photo for each service; the session-type picker
-- showed only text. The obvious source was the treatment images already in the
-- code, matched by label — but tier labels are edited from Bookings → Settings,
-- so renaming "Soléa" would silently drop its image, and the match already
-- fails on "Drenaje Linfático Brasileño" against the treatment slug
-- `drenaje-linfatico`. It also gives nothing to the other three services, whose
-- tiers are durations.
--
-- A column instead: set once, survives renames, and works for every service.
-- Where it is empty the picker falls back to the tier's `color`, which is
-- already configured on all eleven rows.

ALTER TABLE service_tiers ADD COLUMN IF NOT EXISTS image_url text;

-- Seed the manual therapies from the images the site already ships, by label.
-- Doing it here rather than at render time means a later rename keeps the
-- image, because it is stored rather than derived.
UPDATE service_tiers SET image_url = '/images/wellness/treatments/espira.webp'             WHERE service_id = 'manual-therapies' AND label = 'Espira';
UPDATE service_tiers SET image_url = '/images/wellness/treatments/pulse.webp'              WHERE service_id = 'manual-therapies' AND label = 'Pulse';
UPDATE service_tiers SET image_url = '/images/wellness/treatments/drenaje-linfatico.webp'  WHERE service_id = 'manual-therapies' AND label = 'Drenaje Linfático Brasileño';
UPDATE service_tiers SET image_url = '/images/wellness/treatments/essentia-active.webp'    WHERE service_id = 'manual-therapies' AND label = 'Essentia Active';
UPDATE service_tiers SET image_url = '/images/wellness/treatments/nurtura.webp'            WHERE service_id = 'manual-therapies' AND label = 'Nurtura';
UPDATE service_tiers SET image_url = '/images/wellness/treatments/serenna.webp'            WHERE service_id = 'manual-therapies' AND label = 'Serenna';
UPDATE service_tiers SET image_url = '/images/wellness/treatments/solea.webp'              WHERE service_id = 'manual-therapies' AND label = 'Soléa';
UPDATE service_tiers SET image_url = '/images/wellness/treatments/soma.webp'               WHERE service_id = 'manual-therapies' AND label = 'Soma';
UPDATE service_tiers SET image_url = '/images/wellness/treatments/lume.webp'               WHERE service_id = 'manual-therapies' AND label = 'Lume';
UPDATE service_tiers SET image_url = '/images/wellness/treatments/alure-duo.webp'          WHERE service_id = 'manual-therapies' AND label = 'Alure Duo';
UPDATE service_tiers SET image_url = '/images/wellness/treatments/essentia-signature.webp' WHERE service_id = 'manual-therapies' AND label = 'Essentia Signature';

-- Should return 11 rows with an image and none without, for manual therapies.
--
--   SELECT label, image_url FROM service_tiers
--   WHERE service_id = 'manual-therapies' ORDER BY sort_order;
