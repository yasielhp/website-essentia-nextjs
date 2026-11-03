-- Anesis, the fourth facial: hydrating facial and cranio-facial massage,
-- 50 min, 70 EUR.
--
-- The public booking form matches a tier to its page by `label === title`, so
-- the label must stay exactly `Anesis` (app/data/services-data.ts).
--
-- `color` is unique (service_tiers_color_unique, 20260809f). Instead of
-- hardcoding one that may be taken, pick the first candidate nobody uses. If
-- every candidate is taken the colour stays NULL (the index ignores NULLs) and
-- can be set from Ajustes > Reservas.
--
-- sort_order -1 lists it first. Prices are the centre's to change afterwards
-- from Ajustes > Reservas; the hotel menu prices do not match the live ones.
--
-- Apply by hand, from the repo root:
--   npx @insforge/cli@latest db query "$(cat insforge/migrations/20261105_tier_anesis.sql)"
-- Verify:
--   SELECT label, duration_minutes, price_eur, price_center_eur, color, sort_order
--   FROM service_tiers WHERE service_id = 'facial-therapies';

INSERT INTO service_tiers
  (service_id, label, duration_minutes, price_eur, price_center_eur, color, active, sort_order, image_url)
SELECT
  'facial-therapies', 'Anesis', 50, 70, 70,
  (
    SELECT c
    FROM unnest(ARRAY['#0d9488', '#14b8a6', '#06b6d4', '#84cc16', '#a855f7', '#e11d48', '#65a30d']) AS c
    WHERE NOT EXISTS (SELECT 1 FROM service_tiers t WHERE lower(t.color) = lower(c))
    LIMIT 1
  ),
  true, -1,
  -- TODO: anesis-1200x675.webp once the centre sends photos; Eleva's meanwhile.
  '/images/wellness/facials/cards/eleva-1200x675.webp'
WHERE NOT EXISTS (
  SELECT 1 FROM service_tiers WHERE service_id = 'facial-therapies' AND label = 'Anesis'
);
