ALTER TABLE staff_services ADD COLUMN IF NOT EXISTS google_access_token text;
ALTER TABLE staff_services ADD COLUMN IF NOT EXISTS google_refresh_token text;
ALTER TABLE staff_services ADD COLUMN IF NOT EXISTS google_token_expires_at timestamptz;
