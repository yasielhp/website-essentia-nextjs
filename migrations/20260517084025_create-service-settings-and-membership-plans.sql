-- Service settings: pricing, duration, active status per service
CREATE TABLE service_settings (
  id               text PRIMARY KEY,
  title            text NOT NULL,
  price_eur        numeric(10,2),
  duration_minutes integer,
  active           boolean NOT NULL DEFAULT true,
  description      text,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

INSERT INTO service_settings (id, title) VALUES
  ('contrast-therapy',     'Contrast Therapy'),
  ('breathing-sessions',   'Breathing Sessions'),
  ('red-light-therapy',    'Red Light Therapy'),
  ('manual-therapies',     'Manual Therapies'),
  ('functional-well-being','Functional Well-being'),
  ('hyperbaric-chambers',  'Hyperbaric Chambers'),
  ('intravenous-therapy',  'Intravenous Therapy'),
  ('regenerative-medicine','Regenerative Medicine');

-- Membership plans: pricing per tier
CREATE TABLE membership_plans (
  id            text PRIMARY KEY,
  label         text NOT NULL,
  price_monthly numeric(10,2),
  price_annual  numeric(10,2),
  features      text[] NOT NULL DEFAULT '{}',
  active        boolean NOT NULL DEFAULT true,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

INSERT INTO membership_plans (id, label, price_monthly, price_annual, features) VALUES
  ('basic',   'Basic',   49.00,  499.00,  ARRAY['Access to basic services','Monthly newsletter']),
  ('premium', 'Premium', 99.00,  999.00,  ARRAY['Access to all services','Priority booking','Monthly newsletter']),
  ('vip',     'VIP',     199.00, 1999.00, ARRAY['Unlimited access','Priority booking','Personal advisor','Monthly newsletter']);
