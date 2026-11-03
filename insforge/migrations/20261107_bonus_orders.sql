ALTER TABLE bonus_plans DROP COLUMN IF EXISTS sell_online;

-- A bonus bought on the public site. The order is created before the client
-- reaches the bank and copies the plan's sessions, price and validity, so a
-- price changed afterwards cannot alter what was charged. It becomes a
-- contact_bonuses row only once Redsys confirms the payment, and only while it
-- is still `pending`, which is what makes a retried notification harmless.
-- RLS is on with no policies: only the service key reads or writes it.
CREATE TABLE IF NOT EXISTS bonus_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid REFERENCES bonus_plans(id) ON DELETE SET NULL,
  tier_id uuid NOT NULL REFERENCES service_tiers(id) ON DELETE RESTRICT,
  sessions integer NOT NULL CHECK (sessions BETWEEN 1 AND 50),
  price_eur numeric(10,2) NOT NULL CHECK (price_eur >= 0),
  validity_days integer NOT NULL CHECK (validity_days BETWEEN 1 AND 1095),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  preferred_language text NOT NULL DEFAULT 'es' CHECK (preferred_language IN ('en','es')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','failed')),
  redsys_order text UNIQUE,
  contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL,
  contact_bonus_id uuid REFERENCES contact_bonuses(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at timestamptz,
  paid_amount_eur numeric(10,2)
);

ALTER TABLE bonus_orders ENABLE ROW LEVEL SECURITY;
