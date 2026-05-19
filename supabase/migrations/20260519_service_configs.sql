CREATE TABLE IF NOT EXISTS service_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id text UNIQUE NOT NULL,
  google_calendar_id text,
  google_access_token text,
  google_refresh_token text,
  google_token_expires_at timestamptz,
  google_connected_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE service_configs ENABLE ROW LEVEL SECURITY;
-- Solo accesible con service key (no desde el cliente)
CREATE POLICY "no_anon_access" ON service_configs FOR ALL USING (false);
