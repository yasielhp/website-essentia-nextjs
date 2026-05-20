-- Seed service_tiers for Manual Therapies
-- Each row represents one massage type available for booking.
-- price_center_eur = treatment room price
-- price_suite_eur  = private Baobab suite price (NULL when not available in suite)
-- price_eur kept in sync with price_center_eur for backwards compatibility

INSERT INTO service_tiers
  (service_id, label, duration_minutes, price_eur, price_center_eur, price_suite_eur, color, active, sort_order)
VALUES
  ('manual-therapies', 'Espira',                     30,  90.00,  90.00, 120.00, '#d97706', true, 0),
  ('manual-therapies', 'Pulse',                      45, 100.00, 100.00, 130.00, '#b45309', true, 1),
  ('manual-therapies', 'Drenaje Linfático Brasileño',50, 100.00, 100.00, 130.00, '#92400e', true, 2),
  ('manual-therapies', 'Essentia Active',             45, 110.00, 110.00, 140.00, '#16a34a', true, 3),
  ('manual-therapies', 'Nurtura',                    50, 130.00, 130.00, 160.00, '#ec4899', true, 4),
  ('manual-therapies', 'Serenna',                    50, 130.00, 130.00, 160.00, '#8b5cf6', true, 5),
  ('manual-therapies', 'Soléa',                      70, 150.00, 150.00, 180.00, '#f59e0b', true, 6),
  ('manual-therapies', 'Soma',                       60, 160.00, 160.00, 190.00, '#0ea5e9', true, 7),
  ('manual-therapies', 'Lume',                       80, 220.00, 220.00, 250.00, '#6366f1', true, 8),
  ('manual-therapies', 'Alure Duo',                  50, 270.00, 270.00,   NULL, '#f43f5e', true, 9),
  ('manual-therapies', 'Essentia Signature',        120, 350.00, 350.00,   NULL, '#103838', true, 10)
ON CONFLICT DO NOTHING;
