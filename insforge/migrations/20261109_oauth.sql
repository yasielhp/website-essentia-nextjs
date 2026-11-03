CREATE TABLE IF NOT EXISTS oauth_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL UNIQUE,
  client_name text NOT NULL,
  redirect_uris jsonb NOT NULL,
  token_endpoint_auth_method text NOT NULL DEFAULT 'none',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Authorization codes and tokens are stored as SHA-256 hashes, never as the
-- value that was handed out: reading this table does not let anyone in.
CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash text PRIMARY KEY,
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  redirect_uri text NOT NULL,
  code_challenge text NOT NULL,
  code_challenge_method text NOT NULL DEFAULT 'S256' CHECK (code_challenge_method = 'S256'),
  scope text NOT NULL DEFAULT '',
  resource text,
  expires_at timestamptz NOT NULL,
  used_at timestamptz
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  token_hash text PRIMARY KEY,
  id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  refresh_hash text NOT NULL UNIQUE,
  client_id text NOT NULL REFERENCES oauth_clients(client_id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz
);

CREATE INDEX IF NOT EXISTS oauth_tokens_user_idx ON oauth_tokens (user_id) WHERE revoked_at IS NULL;
CREATE INDEX IF NOT EXISTS oauth_codes_expires_idx ON oauth_codes (expires_at);

-- RLS on with no policies: only the service key reads or writes these.
ALTER TABLE oauth_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_tokens ENABLE ROW LEVEL SECURITY;
