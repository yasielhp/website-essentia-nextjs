-- Add Google Calendar token columns to the profiles table so individual
-- staff users can each connect their own Google Calendar account.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_access_token text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_refresh_token text;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_token_expires_at timestamptz;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS google_connected_email text;
