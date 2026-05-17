-- Add color and active fields to service_tiers
ALTER TABLE service_tiers
  ADD COLUMN IF NOT EXISTS color  text,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

-- Seed tiers from current website data
-- Wellness services
INSERT INTO service_tiers (service_id, label, duration_minutes, price_eur, color, sort_order) VALUES
  ('contrast-therapy',      'Standard',      60,  45.00,  '#0284c7', 0),
  ('breathing-sessions',    'Group Session', 45,  35.00,  '#7c3aed', 0),
  ('breathing-sessions',    'Private 1:1',   45,  60.00,  '#7c3aed', 1),
  ('red-light-therapy',     'Standard',      20,  25.00,  '#dc2626', 0),
  ('manual-therapies',      '60 min',        60,  80.00,  '#d97706', 0),
  ('manual-therapies',      '90 min',        90, 110.00,  '#d97706', 1),
  ('functional-well-being', 'Standard',      50,  65.00,  '#16a34a', 0),
-- Medicine services
  ('hyperbaric-chambers',   'Standard',      60, 120.00,  '#0891b2', 0),
  ('intravenous-therapy',   'Standard',      45,  95.00,  '#9333ea', 0),
  ('intravenous-therapy',   'NAD+',          90, 180.00,  '#9333ea', 1),
  ('regenerative-medicine', 'Consultation',  60, 250.00,  '#059669', 0);