CREATE TABLE IF NOT EXISTS bonus_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_id uuid NOT NULL REFERENCES service_tiers(id) ON DELETE CASCADE,
  name text NOT NULL,
  sessions integer NOT NULL CHECK (sessions BETWEEN 1 AND 50),
  price_eur numeric(10,2) NOT NULL CHECK (price_eur >= 0),
  validity_days integer NOT NULL DEFAULT 180 CHECK (validity_days BETWEEN 1 AND 1095),
  active boolean NOT NULL DEFAULT true,
  sell_online boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS contact_bonuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  plan_id uuid REFERENCES bonus_plans(id) ON DELETE SET NULL,
  tier_id uuid NOT NULL REFERENCES service_tiers(id) ON DELETE RESTRICT,
  name text NOT NULL,
  sessions_total integer NOT NULL CHECK (sessions_total BETWEEN 1 AND 50),
  price_eur numeric(10,2) NOT NULL,
  paid_method text CHECK (paid_method IS NULL OR paid_method IN ('cash','card','transfer','online','other')),
  purchased_at date NOT NULL DEFAULT CURRENT_DATE,
  expires_at date NOT NULL,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contact_bonuses_contact_idx ON contact_bonuses (contact_id);

ALTER TABLE bookings ADD COLUMN IF NOT EXISTS bonus_id uuid REFERENCES contact_bonuses(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS bookings_bonus_idx ON bookings (bonus_id) WHERE bonus_id IS NOT NULL;

-- Una fila por (tipo de sesión, nombre): el seed de abajo se puede repetir sin duplicar.
CREATE UNIQUE INDEX IF NOT EXISTS bonus_plans_tier_name_idx ON bonus_plans (tier_id, name);

ALTER TABLE bonus_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_bonuses ENABLE ROW LEVEL SECURITY;

-- Bonos reales según la carta del centro (2026-11-03): 5 sesiones 450 € (90 €/sesión),
-- 10 sesiones 800 € (80 €/sesión). Cada sesión es una zona. Validez: 180 días (no fijada
-- por el centro; editable desde Ajustes → Bonos).
INSERT INTO bonus_plans (tier_id, name, sessions, price_eur, validity_days)
SELECT id, 'Bono 5 sesiones de drenaje', 5, 450, 180 FROM service_tiers WHERE id = '59d57d59-7b9b-4e32-83fe-c144ec7e8a24'
ON CONFLICT DO NOTHING;
INSERT INTO bonus_plans (tier_id, name, sessions, price_eur, validity_days)
SELECT id, 'Bono 10 sesiones de drenaje', 10, 800, 180 FROM service_tiers WHERE id = '59d57d59-7b9b-4e32-83fe-c144ec7e8a24'
ON CONFLICT DO NOTHING;
